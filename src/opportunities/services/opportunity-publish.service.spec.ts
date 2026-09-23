import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { OutboxPublisherService } from '../../events/outbox-publisher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetUrlService } from './asset-url.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDocumentService } from './opportunity-document.service';
import { OpportunityPublishService } from './opportunity-publish.service';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

const user: AuthenticatedUser = {
  id: 'owner-1',
  email: 'owner@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

describe('OpportunityPublishService', () => {
  let versionCounter: number;
  let draft: Record<string, unknown>;
  let createdVersions: Array<Record<string, unknown>>;
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunity: { update: ReturnType<typeof vi.fn> };
    opportunityDraft: { findUnique: ReturnType<typeof vi.fn> };
    opportunityAsset: { findMany: ReturnType<typeof vi.fn> };
    opportunityVersion: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
    outboxEvent: { create: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let outbox: { scheduleDispatch: ReturnType<typeof vi.fn> };
  let service: OpportunityPublishService;

  beforeEach(() => {
    versionCounter = 0;
    createdVersions = [];
    draft = {
      opportunityId: 'opp-1',
      format: 'tiptap',
      schemaVersion: 1,
      content: {
        type: 'doc',
        content: [{ type: 'text', text: 'Version one copy' }],
      },
      revision: 4,
    };

    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunity: {
        update: vi.fn(() => {
          versionCounter += 1;
          return Promise.resolve({
            id: 'opp-1',
            brandId: 'brand-1',
            title: 'AW27 Knitwear',
            summary: 'An artisan collaboration',
            metadata: { season: 'AW27' },
            latestVersionNumber: versionCounter,
          });
        }),
      },
      opportunityDraft: {
        findUnique: vi.fn(() => Promise.resolve(structuredClone(draft))),
      },
      opportunityAsset: { findMany: vi.fn().mockResolvedValue([]) },
      opportunityVersion: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
          const version = {
            id: `version-${String(data.versionNumber)}`,
            ...structuredClone(data),
            assets: [],
            publishedAt: new Date('2026-02-01T00:00:00.000Z'),
          };
          createdVersions.push(version);
          return Promise.resolve(version);
        }),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };
    access = { authorize: vi.fn().mockResolvedValue({}) };
    outbox = { scheduleDispatch: vi.fn().mockResolvedValue(undefined) };

    const documents = new OpportunityDocumentService();
    service = new OpportunityPublishService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      documents,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
      {
        sign: vi.fn().mockResolvedValue({
          url: 'https://signed/x',
          urlExpiresAt: new Date(),
        }),
      } as unknown as AssetUrlService,
      outbox as unknown as OutboxPublisherService,
    );
  });

  it('requires the PUBLISH capability', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(service.publish('opp-1', user, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('first publish creates v1 from an atomic increment on a non-archived row', async () => {
    const v1 = await service.publish('opp-1', user, { notes: 'First look' });

    expect(access.authorize).toHaveBeenCalledWith(
      'opp-1',
      user,
      OpportunityAction.PUBLISH,
    );
    expect(prisma.opportunity.update).toHaveBeenCalledWith({
      where: { id: 'opp-1', archivedAt: null },
      data: expect.objectContaining({
        latestVersionNumber: { increment: 1 },
        status: 'PUBLISHED',
      }) as unknown,
    });
    expect(v1).toMatchObject({
      versionNumber: 1,
      title: 'AW27 Knitwear',
      draftRevision: 4,
      notes: 'First look',
    });
    expect(v1.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('second publish creates v2 and v1 remains unchanged after the draft is edited', async () => {
    const v1 = await service.publish('opp-1', user, {});
    const v1Snapshot = structuredClone(createdVersions[0]);

    // The founder keeps editing the draft...
    draft = {
      ...draft,
      content: {
        type: 'doc',
        content: [{ type: 'text', text: 'Version two copy' }],
      },
      revision: 5,
    };
    const v2 = await service.publish('opp-1', user, {});

    expect(v2.versionNumber).toBe(2);
    expect(v2.content).toEqual(draft.content);
    expect(v2.contentHash).not.toBe(v1.contentHash);
    // v1 as stored is byte-for-byte what it was, and no mutation was issued.
    expect(createdVersions[0]).toEqual(v1Snapshot);
    expect(v1.content).toEqual({
      type: 'doc',
      content: [{ type: 'text', text: 'Version one copy' }],
    });
    expect(prisma.opportunityVersion.update).not.toHaveBeenCalled();
    expect(prisma.opportunityVersion.updateMany).not.toHaveBeenCalled();
    expect(prisma.opportunityVersion.delete).not.toHaveBeenCalled();
  });

  it('pins referenced assets with a snapshot of their alt text', async () => {
    draft = {
      ...draft,
      content: {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: `asset:${ASSET_ID}` } }],
      },
    };
    prisma.opportunityAsset.findMany.mockResolvedValue([
      { id: ASSET_ID, altText: 'Hand sketch', opportunityId: 'opp-1' },
    ]);

    await service.publish('opp-1', user, {});

    const { data } = prisma.opportunityVersion.create.mock.calls[0][0] as {
      data: { assets: { create: unknown[] } };
    };
    expect(data.assets.create).toEqual([
      { assetId: ASSET_ID, altText: 'Hand sketch' },
    ]);
  });

  it('refuses to publish when a referenced asset was deleted', async () => {
    draft = {
      ...draft,
      content: {
        type: 'doc',
        content: [{ type: 'image', attrs: { assetId: ASSET_ID } }],
      },
    };
    prisma.opportunityAsset.findMany.mockResolvedValue([]);

    await expect(service.publish('opp-1', user, {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(prisma.opportunityVersion.create).not.toHaveBeenCalled();
  });

  it('refuses to publish a blank draft', async () => {
    draft = { ...draft, format: 'blank', content: {} };

    await expect(service.publish('opp-1', user, {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('refuses when the draft moved past the reviewed revision', async () => {
    await expect(
      service.publish('opp-1', user, { expectedDraftRevision: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opportunityVersion.create).not.toHaveBeenCalled();
  });

  it('maps a version-number collision (unique constraint) to 409', async () => {
    prisma.opportunityVersion.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.publish('opp-1', user, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps a concurrent archive (row no longer matches) to 409', async () => {
    prisma.opportunity.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.publish('opp-1', user, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('writes the outbox event in the transaction and dispatches it after commit', async () => {
    await service.publish('opp-1', user, {});

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: 'Opportunity',
        aggregateId: 'opp-1',
        eventType: 'opportunity.published',
      }) as unknown,
    });
    expect(outbox.scheduleDispatch).toHaveBeenCalledWith('outbox-1');
  });

  it('still succeeds if the outbox fast path fails (poller is the safety net)', async () => {
    outbox.scheduleDispatch.mockRejectedValue(new Error('redis down'));

    await expect(service.publish('opp-1', user, {})).resolves.toMatchObject({
      versionNumber: 1,
    });
  });
});
