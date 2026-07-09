import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';
import { FollowersService } from './followers.service';

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brand-1',
    ownerId: 'owner-1',
    name: 'Atelier Noir',
    slug: 'atelier-noir',
    isActive: true,
    followersCount: 3,
    profile: null,
    categories: [],
    ...overrides,
  };
}

describe('FollowersService', () => {
  let prisma: {
    brandFollower: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let brandsService: BrandsService;
  let service: FollowersService;

  beforeEach(() => {
    prisma = {
      brandFollower: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      brand: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(),
    };
    brandsService = new BrandsService(prisma as unknown as PrismaService);
    service = new FollowersService(
      prisma as unknown as PrismaService,
      brandsService,
    );
  });

  describe('follow', () => {
    it('creates a follow row and increments the counter', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brandFollower.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([
        {},
        buildBrand({ followersCount: 4 }),
      ]);

      const result = await service.follow('brand-1', 'user-1');

      expect(result).toEqual({ following: true, followersCount: 4 });
    });

    it('is idempotent when already following', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brandFollower.findUnique.mockResolvedValue({ id: 'follow-1' });

      const result = await service.follow('brand-1', 'user-1');

      expect(result).toEqual({ following: true, followersCount: 3 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('deletes the follow row and decrements the counter', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brandFollower.findUnique.mockResolvedValue({ id: 'follow-1' });
      prisma.$transaction.mockResolvedValue([
        {},
        buildBrand({ followersCount: 2 }),
      ]);

      const result = await service.unfollow('brand-1', 'user-1');

      expect(result).toEqual({ following: false, followersCount: 2 });
    });

    it('is idempotent when not following', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brandFollower.findUnique.mockResolvedValue(null);

      const result = await service.unfollow('brand-1', 'user-1');

      expect(result).toEqual({ following: false, followersCount: 3 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('listFollowers', () => {
    it('maps follower rows to safe public fields', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.$transaction.mockResolvedValue([
        [
          {
            user: { id: 'user-2', displayName: 'Jane', avatarUrl: null },
          },
        ],
        1,
      ]);

      const result = await service.listFollowers('brand-1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([
        { id: 'user-2', displayName: 'Jane', avatarUrl: null },
      ]);
      expect(result.total).toBe(1);
    });
  });
});
