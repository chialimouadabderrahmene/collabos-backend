import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { hashShareToken } from '../utils/share-token.util';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityPublishService } from './opportunity-publish.service';
import { OpportunityShareLinksService } from './opportunity-share-links.service';

const VALID_TOKEN = 'A'.repeat(43);

const user: AuthenticatedUser = {
  id: 'owner-1',
  email: 'owner@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

const PUBLISHED_CONTENT = {
  type: 'doc',
  content: [{ type: 'text', text: 'Published v1' }],
};

function buildLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    opportunityId: 'opp-1',
    versionId: 'version-1',
    tokenHash: hashShareToken(VALID_TOKEN),
    tokenPrefix: 'AAAAAA',
    label: null,
    expiresAt: null,
    revokedAt: null,
    revokedById: null,
    createdById: 'owner-1',
    accessCount: 0,
    lastAccessedAt: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    opportunity: {
      archivedAt: null,
      brand: { name: 'Atelier Noir', logoUrl: null, isActive: true },
    },
    version: {
      id: 'version-1',
      versionNumber: 1,
      title: 'AW27 Knitwear',
      summary: 'Summary v1',
      metadata: { season: 'AW27' },
      format: 'tiptap',
      schemaVersion: 1,
      content: PUBLISHED_CONTENT,
      publishedAt: new Date('2026-02-01T00:00:00.000Z'),
      assets: [],
    },
    ...overrides,
  };
}

describe('OpportunityShareLinksService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunityShareLink: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    opportunityVersion: { findUnique: ReturnType<typeof vi.fn> };
    opportunityDraft: { findUnique: ReturnType<typeof vi.fn> };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let service: OpportunityShareLinksService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunityShareLink: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...buildLink(),
            ...data,
            id: 'link-new',
          }),
        ),
        findUnique: vi.fn().mockResolvedValue(buildLink()),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      opportunityVersion: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'version-1', versionNumber: 1 }),
      },
      opportunityDraft: { findUnique: vi.fn() },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
    };
    access = { authorize: vi.fn().mockResolvedValue({}) };
    const publishService = {
      toPublishedAssets: vi.fn().mockResolvedValue([]),
    } as unknown as OpportunityPublishService;

    service = new OpportunityShareLinksService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
      publishService,
      {
        get: vi.fn().mockReturnValue('https://app.collabos.io/share/'),
      } as unknown as ConfigService,
    );
  });

  describe('create', () => {
    it('requires SHARE, pins the version and stores only the token hash', async () => {
      const created = await service.create('opp-1', user, { versionNumber: 1 });

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.SHARE,
      );
      const { data } = prisma.opportunityShareLink.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.versionId).toBe('version-1');
      expect(data.tokenHash).toBe(hashShareToken(created.token));
      expect(Object.values(data)).not.toContain(created.token);
      expect(created.url).toBe(
        `https://app.collabos.io/share/${created.token}`,
      );
      expect(created.versionNumber).toBe(1);
    });

    it('never writes the raw token into the activity log', async () => {
      const created = await service.create('opp-1', user, { versionNumber: 1 });

      const activity = JSON.stringify(
        prisma.opportunityActivity.create.mock.calls[0][0],
      );
      expect(activity).not.toContain(created.token);
    });

    it('rejects an unknown version', async () => {
      prisma.opportunityVersion.findUnique.mockResolvedValue(null);

      await expect(
        service.create('opp-1', user, { versionNumber: 9 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects expiry in the past or too far ahead', async () => {
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          expiresAt: new Date(Date.now() + 400 * 86_400_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolve (public)', () => {
    it('returns the pinned published version for a valid token', async () => {
      const shared = await service.resolve(VALID_TOKEN);

      expect(prisma.opportunityShareLink.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashShareToken(VALID_TOKEN) },
        }),
      );
      expect(shared).toMatchObject({
        title: 'AW27 Knitwear',
        versionNumber: 1,
        content: PUBLISHED_CONTENT,
        brand: { name: 'Atelier Noir', logoUrl: null },
      });
      expect(prisma.opportunityShareLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: expect.objectContaining({
          accessCount: { increment: 1 },
        }) as unknown,
      });
    });

    it('never reads or exposes the draft, nor internal identifiers', async () => {
      const shared = await service.resolve(VALID_TOKEN);

      expect(prisma.opportunityDraft.findUnique).not.toHaveBeenCalled();
      expect(Object.keys(shared).sort()).toEqual(
        [
          'assets',
          'brand',
          'content',
          'expiresAt',
          'format',
          'metadata',
          'publishedAt',
          'schemaVersion',
          'summary',
          'title',
          'versionNumber',
        ].sort(),
      );
      const serialized = JSON.stringify(shared);
      expect(serialized).not.toContain('opp-1');
      expect(serialized).not.toContain('version-1');
      expect(serialized).not.toContain('owner-1');
    });

    it('rejects a malformed token without hitting the database', async () => {
      await expect(service.resolve('not-a-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.opportunityShareLink.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      prisma.opportunityShareLink.findUnique.mockResolvedValue(null);

      await expect(service.resolve(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a revoked token', async () => {
      prisma.opportunityShareLink.findUnique.mockResolvedValue(
        buildLink({ revokedAt: new Date() }),
      );

      await expect(service.resolve(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.opportunityShareLink.update).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.opportunityShareLink.findUnique.mockResolvedValue(
        buildLink({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(service.resolve(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects links of an archived opportunity or a suspended brand', async () => {
      prisma.opportunityShareLink.findUnique.mockResolvedValue(
        buildLink({
          opportunity: {
            archivedAt: new Date(),
            brand: { name: 'x', logoUrl: null, isActive: true },
          },
        }),
      );
      await expect(service.resolve(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.opportunityShareLink.findUnique.mockResolvedValue(
        buildLink({
          opportunity: {
            archivedAt: null,
            brand: { name: 'x', logoUrl: null, isActive: false },
          },
        }),
      );
      await expect(service.resolve(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('still serves content if access tracking fails', async () => {
      prisma.opportunityShareLink.update.mockRejectedValue(
        new Error('db busy'),
      );

      await expect(service.resolve(VALID_TOKEN)).resolves.toMatchObject({
        versionNumber: 1,
      });
    });
  });

  describe('revoke', () => {
    it('revokes an active link of this opportunity', async () => {
      prisma.opportunityShareLink.findFirst.mockResolvedValue({
        id: 'link-1',
        revokedAt: null,
      });

      await service.revoke('opp-1', 'link-1', user);

      expect(prisma.opportunityShareLink.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'link-1', opportunityId: 'opp-1' },
        }),
      );
      expect(prisma.opportunityShareLink.updateMany).toHaveBeenCalledWith({
        where: { id: 'link-1', revokedAt: null },
        data: expect.objectContaining({ revokedById: 'owner-1' }) as unknown,
      });
    });

    it('is idempotent', async () => {
      prisma.opportunityShareLink.findFirst.mockResolvedValue({
        id: 'link-1',
        revokedAt: new Date(),
      });

      await expect(service.revoke('opp-1', 'link-1', user)).resolves.toEqual({
        message: 'Share link revoked',
      });
      expect(prisma.opportunityShareLink.updateMany).not.toHaveBeenCalled();
    });

    it('cannot revoke a link belonging to another opportunity', async () => {
      prisma.opportunityShareLink.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke('opp-1', 'foreign-link', user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
