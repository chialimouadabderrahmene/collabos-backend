import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../../src/auth/interfaces/jwt-payload.interface';
import { BrandAccessService } from '../../src/brands/services/brand-access.service';
import { OutboxPublisherService } from '../../src/events/outbox-publisher.service';
import { AssetUrlService } from '../../src/opportunities/services/asset-url.service';
import { OpportunitiesService } from '../../src/opportunities/services/opportunities.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from '../../src/opportunities/services/opportunity-access.service';
import { OpportunityActivityService } from '../../src/opportunities/services/opportunity-activity.service';
import { OpportunityDocumentService } from '../../src/opportunities/services/opportunity-document.service';
import { OpportunityDraftService } from '../../src/opportunities/services/opportunity-draft.service';
import { OpportunityPublishService } from '../../src/opportunities/services/opportunity-publish.service';
import { OpportunityShareLinksService } from '../../src/opportunities/services/opportunity-share-links.service';
import {
  canonicalJson,
  sha256Hex,
} from '../../src/opportunities/utils/document.util';
import { PrismaService } from '../../src/prisma/prisma.service';
import type { StorageProvider } from '../../src/storage/storage-provider.interface';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;

function authUser(id: string): AuthenticatedUser {
  return {
    id,
    email: `${id}@it.test`,
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
  };
}

function doc(text: string) {
  return {
    format: 'tiptap' as const,
    schemaVersion: 1,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  };
}

describe.skipIf(!databaseUrl)('Opportunity studio (PostgreSQL)', () => {
  let prisma: PrismaService;
  let opportunities: OpportunitiesService;
  let drafts: OpportunityDraftService;
  let publisher: OpportunityPublishService;
  let shareLinks: OpportunityShareLinksService;
  let access: OpportunityAccessService;

  // Fresh identities per run: published versions are immutable, so the
  // database is never cleaned by deleting rows.
  const run = randomUUID().slice(0, 8);
  const ownerA = authUser(`owner-a-${run}`);
  const ownerB = authUser(`owner-b-${run}`);
  const collaborator = authUser(`collab-${run}`);
  const brandA = `brand-a-${run}`;
  const brandB = `brand-b-${run}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();

    for (const user of [ownerA, ownerB, collaborator]) {
      await prisma.user.create({
        data: { id: user.id, email: user.email, passwordHash: 'x' },
      });
    }
    for (const [id, ownerId] of [
      [brandA, ownerA.id],
      [brandB, ownerB.id],
    ]) {
      await prisma.brand.create({
        data: {
          id,
          ownerId,
          name: id,
          slug: id,
          members: { create: { userId: ownerId, role: 'OWNER' } },
        },
      });
    }

    const config = {
      get: (key: string) =>
        ({
          'opportunities.assetUrlTtlSeconds': 900,
          'opportunities.shareBaseUrl': 'https://app.test/share',
        })[key],
    } as unknown as ConfigService;
    const storage: StorageProvider = {
      upload: ({ key }) => Promise.resolve({ key, url: key }),
      getSignedUrl: (key) => Promise.resolve(`https://signed.test/${key}`),
      delete: () => Promise.resolve(),
    };
    const outbox = {
      scheduleDispatch: () => Promise.resolve(),
    } as unknown as OutboxPublisherService;

    const brandAccess = new BrandAccessService(prisma);
    access = new OpportunityAccessService(prisma, brandAccess);
    const documents = new OpportunityDocumentService();
    const activity = new OpportunityActivityService(prisma, access);
    const assetUrls = new AssetUrlService(storage, config);

    opportunities = new OpportunitiesService(
      prisma,
      access,
      brandAccess,
      documents,
      activity,
    );
    drafts = new OpportunityDraftService(prisma, access, documents);
    publisher = new OpportunityPublishService(
      prisma,
      access,
      documents,
      activity,
      assetUrls,
      outbox,
    );
    shareLinks = new OpportunityShareLinksService(
      prisma,
      access,
      activity,
      publisher,
      config,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function createWithDraft(text: string): Promise<string> {
    const created = await opportunities.create(ownerA, {
      brandId: brandA,
      title: 'AW27 Knitwear',
    });
    const draft = await drafts.get(created.id, ownerA);
    await drafts.save(created.id, ownerA, {
      ...doc(text),
      baseRevision: draft.revision,
    });
    return created.id;
  }

  it('publishing creates v1 then v2, and v1 never changes when the draft is edited', async () => {
    const id = await createWithDraft('Version one');

    const v1 = await publisher.publish(id, ownerA, {});
    expect(v1.versionNumber).toBe(1);

    const current = await drafts.get(id, ownerA);
    expect(current.hasUnpublishedChanges).toBe(false);
    await drafts.save(id, ownerA, {
      ...doc('Edited after publish'),
      baseRevision: current.revision,
    });
    expect((await drafts.get(id, ownerA)).hasUnpublishedChanges).toBe(true);

    const storedV1 = await publisher.getVersion(id, 1, ownerA);
    expect(storedV1.content).toEqual(doc('Version one').content);
    expect(storedV1.contentHash).toBe(v1.contentHash);
    expect(
      sha256Hex(
        canonicalJson({
          title: storedV1.title,
          summary: storedV1.summary,
          metadata: storedV1.metadata,
          format: storedV1.format,
          schemaVersion: storedV1.schemaVersion,
          content: storedV1.content,
        }),
      ),
    ).toBe(storedV1.contentHash);

    const v2 = await publisher.publish(id, ownerA, {});
    expect(v2.versionNumber).toBe(2);
    expect(v2.content).toEqual(doc('Edited after publish').content);
    expect((await publisher.getVersion(id, 1, ownerA)).content).toEqual(
      doc('Version one').content,
    );
  });

  it('concurrent publishes never collide on version numbers', async () => {
    const id = await createWithDraft('Concurrent');

    const results = await Promise.all(
      Array.from({ length: 8 }, () => publisher.publish(id, ownerA, {})),
    );

    const numbers = results
      .map((version) => version.versionNumber)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const row = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
    expect(row.latestVersionNumber).toBe(8);
  });

  it('the database rejects any UPDATE or DELETE of a published version', async () => {
    const id = await createWithDraft('Immutable');
    await publisher.publish(id, ownerA, {});
    const version = await prisma.opportunityVersion.findFirstOrThrow({
      where: { opportunityId: id },
    });

    await expect(
      prisma.opportunityVersion.update({
        where: { id: version.id },
        data: { title: 'tampered' },
      }),
    ).rejects.toThrow(/immutable/);
    await expect(
      prisma.$executeRaw`DELETE FROM "opportunity_versions" WHERE "id" = ${version.id}`,
    ).rejects.toThrow(/immutable/);

    const reloaded = await prisma.opportunityVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    expect(reloaded.title).toBe(version.title);
  });

  it('share links expose exactly the pinned version, and stop working when revoked or expired', async () => {
    const id = await createWithDraft('Shared v1');
    await publisher.publish(id, ownerA, {});
    const link = await shareLinks.create(id, ownerA, { versionNumber: 1 });

    const current = await drafts.get(id, ownerA);
    await drafts.save(id, ownerA, {
      ...doc('SECRET DRAFT TEXT'),
      baseRevision: current.revision,
    });
    await publisher.publish(id, ownerA, {});

    const shared = await shareLinks.resolve(link.token);
    expect(shared.versionNumber).toBe(1);
    expect(shared.content).toEqual(doc('Shared v1').content);
    expect(JSON.stringify(shared)).not.toContain('SECRET DRAFT TEXT');
    expect(JSON.stringify(shared)).not.toContain(id);

    const stored = await prisma.opportunityShareLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(stored.tokenHash).not.toBe(link.token);
    expect(stored.accessCount).toBe(1);

    await shareLinks.revoke(id, link.id, ownerA);
    await expect(shareLinks.resolve(link.token)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const second = await shareLinks.create(id, ownerA, { versionNumber: 2 });
    await prisma.opportunityShareLink.update({
      where: { id: second.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(shareLinks.resolve(second.token)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(shareLinks.resolve('x'.repeat(43))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('isolates tenants: another brand owner cannot see or guess into brand A', async () => {
    const id = await createWithDraft('Private to A');

    await expect(
      access.authorize(id, ownerB, OpportunityAction.VIEW),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(drafts.get(id, ownerB)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      opportunities.create(ownerB, { brandId: brandA, title: 'intrusion' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const listing = await opportunities.findAll(ownerB, {
      page: 1,
      limit: 100,
    });
    expect(listing.data.map((item) => item.id)).not.toContain(id);
  });

  it('an opportunity EDITOR collaborator can edit the draft but not publish', async () => {
    const id = await createWithDraft('Collab');
    await prisma.opportunityMember.create({
      data: { opportunityId: id, userId: collaborator.id, role: 'EDITOR' },
    });

    const draft = await drafts.get(id, collaborator);
    await expect(
      drafts.save(id, collaborator, {
        ...doc('Collaborator edit'),
        baseRevision: draft.revision,
      }),
    ).resolves.toMatchObject({ revision: draft.revision + 1 });
    await expect(
      publisher.publish(id, collaborator, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const listing = await opportunities.findAll(collaborator, {
      page: 1,
      limit: 100,
    });
    expect(listing.data.map((item) => item.id)).toContain(id);
  });
});
