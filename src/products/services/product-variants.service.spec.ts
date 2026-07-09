import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantsService } from './product-variants.service';
import { ProductsService } from './products.service';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'product-1', brandId: 'brand-1', price: 12000, ...overrides };
}

function buildVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'NOIR-M-BLK',
    size: 'M',
    color: 'Black',
    priceOverride: null,
    stockQuantity: 5,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

describe('ProductVariantsService', () => {
  let prisma: {
    productVariant: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let productsService: ProductsService;
  let service: ProductVariantsService;

  beforeEach(() => {
    prisma = {
      productVariant: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    productsService = {
      findEntityOrThrow: vi.fn().mockResolvedValue(buildProduct()),
      assertOwnerOrAdmin: vi.fn().mockResolvedValue(undefined),
      assertViewable: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProductsService;
    service = new ProductVariantsService(
      prisma as unknown as PrismaService,
      productsService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate SKU with a friendly ConflictException', async () => {
      prisma.productVariant.create.mockRejectedValue(
        buildUniqueConstraintError(),
      );

      await expect(
        service.create('product-1', { id: 'owner-1' } as never, {
          sku: 'NOIR-M-BLK',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a variant with the effective price falling back to the product price', async () => {
      prisma.productVariant.create.mockResolvedValue(buildVariant());

      const result = await service.create(
        'product-1',
        { id: 'owner-1' } as never,
        { sku: 'NOIR-M-BLK', size: 'M', color: 'Black' },
      );

      expect(result.effectivePrice).toBe(12000);
    });

    it('uses the variant priceOverride when set', async () => {
      prisma.productVariant.create.mockResolvedValue(
        buildVariant({ priceOverride: 15000 }),
      );

      const result = await service.create(
        'product-1',
        { id: 'owner-1' } as never,
        { sku: 'NOIR-M-BLK', priceOverride: 15000 },
      );

      expect(result.effectivePrice).toBe(15000);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for a variant belonging to another product', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(
        buildVariant({ productId: 'other-product' }),
      );

      await expect(
        service.remove('product-1', 'variant-1', { id: 'owner-1' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the variant instead of destroying stock history', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(buildVariant());

      await service.remove('product-1', 'variant-1', {
        id: 'owner-1',
      } as never);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { isActive: false },
      });
    });
  });

  describe('findAll', () => {
    it('only returns active variants', async () => {
      prisma.productVariant.findMany.mockResolvedValue([buildVariant()]);

      await service.findAll('product-1');

      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { productId: 'product-1', isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
