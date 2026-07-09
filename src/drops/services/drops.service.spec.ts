import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DropsService } from './drops.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'owner-1',
    email: 'owner@brand.com',
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
    ...overrides,
  };
}

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'brand-1', ownerId: 'owner-1', isActive: true, ...overrides };
}

function buildDrop(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'drop-1',
    brandId: 'brand-1',
    dealId: null,
    title: 'SS27 Capsule Collection',
    slug: 'ss27-capsule-collection',
    description: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    publishAt: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DropsService', () => {
  let prisma: {
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    deal: { findUnique: ReturnType<typeof vi.fn> };
    drop: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let queue: {
    getJob: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
  };
  let service: DropsService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn(), findMany: vi.fn() },
      deal: { findUnique: vi.fn() },
      drop: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    queue = { getJob: vi.fn().mockResolvedValue(null), add: vi.fn() };
    service = new DropsService(
      prisma as unknown as PrismaService,
      queue as never,
    );
  });

  describe('create', () => {
    it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.create(buildUser({ id: 'stranger' }), {
          brandId: 'brand-1',
          title: 'SS27 Capsule Collection',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a dealId belonging to a different brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal-1',
        brandId: 'other-brand',
      });

      await expect(
        service.create(buildUser(), {
          brandId: 'brand-1',
          dealId: 'deal-1',
          title: 'SS27 Capsule Collection',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a draft, private drop with a unique slug', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.drop.findUnique.mockResolvedValue(null);
      prisma.drop.create.mockResolvedValue(buildDrop());

      const result = await service.create(buildUser(), {
        brandId: 'brand-1',
        title: 'SS27 Capsule Collection',
      });

      expect(result.status).toBe('DRAFT');
      expect(result.visibility).toBe('PRIVATE');
      expect(result.slug).toBe('ss27-capsule-collection');
    });
  });

  describe('assertViewable', () => {
    it('allows anyone when the drop is published and public', async () => {
      await expect(
        service.assertViewable(
          buildDrop({ status: 'PUBLISHED', visibility: 'PUBLIC' }),
          undefined,
        ),
      ).resolves.toBeUndefined();
    });

    it('hides an unpublished drop from anonymous visitors as not found', async () => {
      await expect(
        service.assertViewable(buildDrop(), undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows the owner to preview an unpublished drop', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.assertViewable(buildDrop(), buildUser()),
      ).resolves.toBeUndefined();
    });
  });

  describe('schedule', () => {
    it('rejects scheduling a non-draft drop', async () => {
      prisma.drop.findUnique.mockResolvedValue(
        buildDrop({ status: 'PUBLISHED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.schedule('drop-1', buildUser(), {
          publishAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a publishAt that is not in the future', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.schedule('drop-1', buildUser(), {
          publishAt: new Date(Date.now() - 86400000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('schedules the drop and enqueues a delayed publish job', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.drop.update.mockResolvedValue(buildDrop({ status: 'SCHEDULED' }));

      const publishAt = new Date(Date.now() + 86400000).toISOString();
      const result = await service.schedule('drop-1', buildUser(), {
        publishAt,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'publish-drop',
        { dropId: 'drop-1' },
        expect.objectContaining({ jobId: 'publish-drop-drop-1' }),
      );
      expect(result.status).toBe('SCHEDULED');
    });
  });

  describe('publish', () => {
    it('rejects publishing an archived drop', async () => {
      prisma.drop.findUnique.mockResolvedValue(
        buildDrop({ status: 'ARCHIVED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.publish('drop-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('publishes a draft drop immediately', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.drop.update.mockResolvedValue(
        buildDrop({ status: 'PUBLISHED', publishedAt: new Date() }),
      );

      const result = await service.publish('drop-1', buildUser());
      expect(result.status).toBe('PUBLISHED');
    });
  });

  describe('publishScheduled', () => {
    it('does nothing if the drop is no longer scheduled', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop({ status: 'DRAFT' }));

      await service.publishScheduled('drop-1');

      expect(prisma.drop.update).not.toHaveBeenCalled();
    });

    it('publishes a still-scheduled drop', async () => {
      prisma.drop.findUnique.mockResolvedValue(
        buildDrop({ status: 'SCHEDULED' }),
      );
      prisma.drop.update.mockResolvedValue(buildDrop({ status: 'PUBLISHED' }));

      await service.publishScheduled('drop-1');

      expect(prisma.drop.update).toHaveBeenCalledWith({
        where: { id: 'drop-1' },
        data: { status: 'PUBLISHED', publishedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('archive', () => {
    it('rejects archiving an already-archived drop', async () => {
      prisma.drop.findUnique.mockResolvedValue(
        buildDrop({ status: 'ARCHIVED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.archive('drop-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
