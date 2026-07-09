import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantsService } from './product-variants.service';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

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
    ...overrides,
  };
}

describe('StockService', () => {
  let prisma: {
    stockMovement: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    productVariant: { update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let productsService: ProductsService;
  let variantsService: ProductVariantsService;
  let service: StockService;

  beforeEach(() => {
    prisma = {
      stockMovement: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      productVariant: { update: vi.fn() },
      $transaction: vi.fn(),
    };
    productsService = {
      findEntityOrThrow: vi.fn().mockResolvedValue(buildProduct()),
      assertOwnerOrAdmin: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProductsService;
    variantsService = {
      findVariantOrThrow: vi.fn().mockResolvedValue(buildVariant()),
    } as unknown as ProductVariantsService;
    service = new StockService(
      prisma as unknown as PrismaService,
      productsService,
      variantsService,
    );
  });

  describe('adjust', () => {
    it('rejects an adjustment that would push stock negative', async () => {
      await expect(
        service.adjust('product-1', 'variant-1', { id: 'owner-1' } as never, {
          type: 'SALE',
          quantity: -10,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('records a restock movement and increases stock', async () => {
      prisma.$transaction.mockResolvedValue([
        {},
        buildVariant({ stockQuantity: 15 }),
      ]);

      const result = await service.adjust(
        'product-1',
        'variant-1',
        { id: 'owner-1' } as never,
        { type: 'RESTOCK', quantity: 10 },
      );

      expect(result.stockQuantity).toBe(15);
    });

    it('records a sale movement and decreases stock', async () => {
      prisma.$transaction.mockResolvedValue([
        {},
        buildVariant({ stockQuantity: 2 }),
      ]);

      const result = await service.adjust(
        'product-1',
        'variant-1',
        { id: 'owner-1' } as never,
        { type: 'SALE', quantity: -3 },
      );

      expect(result.stockQuantity).toBe(2);
    });
  });

  describe('findMovements', () => {
    it('returns a paginated ledger', async () => {
      prisma.$transaction.mockResolvedValue([
        [
          {
            id: 'movement-1',
            type: 'RESTOCK',
            quantity: 10,
            reason: null,
            createdAt: new Date(),
          },
        ],
        1,
      ]);

      const result = await service.findMovements(
        'product-1',
        'variant-1',
        { id: 'owner-1' } as never,
        { page: 1, limit: 20 },
      );

      expect(result.total).toBe(1);
      expect(result.data[0].type).toBe('RESTOCK');
    });
  });
});
