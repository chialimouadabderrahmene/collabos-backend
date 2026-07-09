import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminBrandsService } from './admin-brands.service';

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brand-1',
    name: 'Acme',
    slug: 'acme',
    ownerId: 'owner-1',
    isVerified: false,
    isActive: true,
    followersCount: 10,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AdminBrandsService', () => {
  let prisma: {
    brand: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: AdminBrandsService;

  beforeEach(() => {
    prisma = {
      brand: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new AdminBrandsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns a paginated, mapped list', async () => {
      prisma.brand.findMany.mockResolvedValue([buildBrand()]);
      prisma.brand.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe('Acme');
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('verify', () => {
    it('marks the brand verified with a timestamp', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brand.update.mockResolvedValue(
        buildBrand({ isVerified: true, verifiedAt: new Date() }),
      );

      const result = await service.verify('brand-1');

      const call = prisma.brand.update.mock.calls[0][0] as {
        data: { isVerified: boolean };
      };
      expect(call.data.isVerified).toBe(true);
      expect(result.isVerified).toBe(true);
    });
  });

  describe('unverify', () => {
    it('clears verification', async () => {
      prisma.brand.findUnique.mockResolvedValue(
        buildBrand({ isVerified: true }),
      );
      prisma.brand.update.mockResolvedValue(buildBrand({ isVerified: false }));

      const result = await service.unverify('brand-1');

      expect(result.isVerified).toBe(false);
    });
  });

  describe('activate / deactivate', () => {
    it('deactivates the brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brand.update.mockResolvedValue(buildBrand({ isActive: false }));

      const result = await service.deactivate('brand-1');

      expect(result.isActive).toBe(false);
    });

    it('reactivates the brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(
        buildBrand({ isActive: false }),
      );
      prisma.brand.update.mockResolvedValue(buildBrand({ isActive: true }));

      const result = await service.activate('brand-1');

      expect(result.isActive).toBe(true);
    });
  });
});
