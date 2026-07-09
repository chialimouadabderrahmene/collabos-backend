import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

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

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'product-1',
    brandId: 'brand-1',
    name: 'Noir Bomber Jacket',
    slug: 'noir-bomber-jacket',
    description: null,
    price: 12000,
    compareAtPrice: null,
    currency: 'USD',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    categories: [],
    variants: [],
    ...overrides,
  };
}

describe('ProductsService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    product: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn() },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.create(buildUser({ id: 'stranger' }), {
          brandId: 'brand-1',
          name: 'Noir Bomber Jacket',
          price: 12000,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates an active product with a unique slug', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(buildProduct());

      const result = await service.create(buildUser(), {
        brandId: 'brand-1',
        name: 'Noir Bomber Jacket',
        price: 12000,
      });

      expect(result.slug).toBe('noir-bomber-jacket');
      expect(result.isActive).toBe(true);
      expect(result.totalStock).toBe(0);
    });
  });

  describe('assertViewable', () => {
    it('allows anyone to view an active product', async () => {
      await expect(
        service.assertViewable(buildProduct(), undefined),
      ).resolves.toBeUndefined();
    });

    it('hides an inactive product from anonymous visitors', async () => {
      await expect(
        service.assertViewable(buildProduct({ isActive: false }), undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows the owner to view an inactive product', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.assertViewable(buildProduct({ isActive: false }), buildUser()),
      ).resolves.toBeUndefined();
    });
  });

  describe('remove', () => {
    it('rejects deactivating an already-inactive product', async () => {
      prisma.product.findUnique.mockResolvedValue(
        buildProduct({ isActive: false }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.remove('product-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('deactivates an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      const result = await service.remove('product-1', buildUser());

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { isActive: false },
      });
      expect(result.message).toBe('Product deactivated');
    });
  });

  describe('totalStock', () => {
    it('sums stock across all variants', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.product.findUnique.mockResolvedValue(
        buildProduct({
          variants: [{ stockQuantity: 5 }, { stockQuantity: 3 }],
        }),
      );

      const result = await service.findOneOrThrow('product-1', buildUser());
      expect(result.totalStock).toBe(8);
    });
  });
});
