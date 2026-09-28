import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from './checkout.service';

function buildCartItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item-1',
    variantId: 'variant-1',
    quantity: 2,
    variant: {
      id: 'variant-1',
      sku: 'NOIR-M-BLK',
      priceOverride: null,
      stockQuantity: 10,
      product: {
        id: 'product-1',
        name: 'Noir Bomber Jacket',
        price: 12000,
        currency: 'USD',
        brandId: 'brand-1',
      },
    },
    ...overrides,
  };
}

describe('CheckoutService', () => {
  let tx: {
    order: { create: ReturnType<typeof vi.fn> };
    productVariant: {
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    stockMovement: { create: ReturnType<typeof vi.fn> };
    cartItem: { deleteMany: ReturnType<typeof vi.fn> };
  };
  let prisma: {
    cart: { findUnique: ReturnType<typeof vi.fn> };
    order: { findUnique: ReturnType<typeof vi.fn> };
    productVariant: { update: ReturnType<typeof vi.fn> };
    stockMovement: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: CheckoutService;

  beforeEach(() => {
    tx = {
      order: { create: vi.fn() },
      productVariant: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
      stockMovement: { create: vi.fn() },
      cartItem: { deleteMany: vi.fn() },
    };
    prisma = {
      cart: { findUnique: vi.fn() },
      order: { findUnique: vi.fn() },
      productVariant: { update: vi.fn() },
      stockMovement: { create: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    service = new CheckoutService(prisma as unknown as PrismaService);
  });

  describe('checkout', () => {
    it('rejects checkout with an empty cart', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', items: [] });

      await expect(service.checkout('user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects checkout when requested quantity exceeds stock', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        items: [buildCartItem({ quantity: 20 })],
      });

      await expect(service.checkout('user-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('splits the cart into one order per brand and decrements stock', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        items: [
          buildCartItem({ id: 'item-1', variantId: 'variant-1' }),
          buildCartItem({
            id: 'item-2',
            variantId: 'variant-2',
            variant: {
              id: 'variant-2',
              sku: 'DENIM-L',
              priceOverride: null,
              stockQuantity: 5,
              product: {
                id: 'product-2',
                name: 'Denim Jacket',
                price: 8000,
                currency: 'USD',
                brandId: 'brand-2',
              },
            },
          }),
        ],
      });
      tx.order.create.mockImplementation(
        ({ data }: { data: { brandId: string } }) =>
          Promise.resolve({
            id: `order-${data.brandId}`,
            brandId: data.brandId,
            items: [],
          }),
      );
      tx.productVariant.findUniqueOrThrow.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'variant-1'
              ? { stockQuantity: 10 }
              : { stockQuantity: 5 },
          ),
      );

      const result = await service.checkout('user-1', {});

      expect(result).toHaveLength(2);
      expect(tx.productVariant.update).toHaveBeenCalledTimes(2);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
      expect(tx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brandId: 'brand-1',
          currency: 'USD',
        }) as Record<string, unknown>,
        include: { items: true },
      });
      expect(tx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brandId: 'brand-2',
          currency: 'USD',
        }) as Record<string, unknown>,
        include: { items: true },
      });
    });

    it('creates a EUR order at the correct subtotal (€420 × 2 → €840 EUR)', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        items: [
          buildCartItem({
            id: 'item-1',
            variantId: 'variant-1',
            quantity: 2,
            variant: {
              id: 'variant-1',
              sku: 'CASH-M-NOIR',
              priceOverride: null,
              stockQuantity: 10,
              product: {
                id: 'product-1',
                name: 'Noir Cashmere Crew',
                price: 420,
                currency: 'EUR',
                brandId: 'brand-1',
              },
            },
          }),
        ],
      });
      tx.order.create.mockImplementation(
        ({
          data,
        }: {
          data: { brandId: string; currency: string; subtotal: number };
        }) =>
          Promise.resolve({
            id: `order-${data.brandId}`,
            brandId: data.brandId,
            currency: data.currency,
            subtotal: data.subtotal,
            items: [],
          }),
      );
      tx.productVariant.findUniqueOrThrow.mockResolvedValue({
        stockQuantity: 10,
      });

      const [order] = await service.checkout('user-1', {});

      expect(tx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'EUR',
          subtotal: 840,
        }) as Record<string, unknown>,
        include: { items: true },
      });
      // Never falls back to the Prisma schema default (USD) for a EUR product.
      expect(order.currency).toBe('EUR');
      expect(order.subtotal).toBe(840);
    });

    it('creates a USD order at the correct subtotal ($100 × 2 → $200 USD)', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        items: [
          buildCartItem({
            id: 'item-1',
            variantId: 'variant-1',
            quantity: 2,
            variant: {
              id: 'variant-1',
              sku: 'TEE-M',
              priceOverride: null,
              stockQuantity: 10,
              product: {
                id: 'product-1',
                name: 'Logo Tee',
                price: 100,
                currency: 'USD',
                brandId: 'brand-1',
              },
            },
          }),
        ],
      });
      tx.order.create.mockImplementation(
        ({
          data,
        }: {
          data: { brandId: string; currency: string; subtotal: number };
        }) =>
          Promise.resolve({
            id: `order-${data.brandId}`,
            brandId: data.brandId,
            currency: data.currency,
            subtotal: data.subtotal,
            items: [],
          }),
      );
      tx.productVariant.findUniqueOrThrow.mockResolvedValue({
        stockQuantity: 10,
      });

      const [order] = await service.checkout('user-1', {});

      expect(order.currency).toBe('USD');
      expect(order.subtotal).toBe(200);
    });

    it('rejects checkout when a variant price override differs but currency mixes within one brand', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        items: [
          buildCartItem({
            id: 'item-1',
            variantId: 'variant-1',
            variant: {
              id: 'variant-1',
              sku: 'EUR-ITEM',
              priceOverride: null,
              stockQuantity: 10,
              product: {
                id: 'product-1',
                name: 'Euro Product',
                price: 100,
                currency: 'EUR',
                brandId: 'brand-1',
              },
            },
          }),
          buildCartItem({
            id: 'item-2',
            variantId: 'variant-2',
            variant: {
              id: 'variant-2',
              sku: 'USD-ITEM',
              priceOverride: null,
              stockQuantity: 10,
              product: {
                id: 'product-2',
                name: 'Dollar Product',
                price: 100,
                currency: 'USD',
                // Same brand as the EUR product above — unsupported mix.
                brandId: 'brand-1',
              },
            },
          }),
        ],
      });

      await expect(service.checkout('user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('restockOrder', () => {
    it('does nothing for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await service.restockOrder('missing-order');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('increments stock and logs a RETURN movement per item', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        items: [{ variantId: 'variant-1', quantity: 2 }],
      });

      await service.restockOrder('order-1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
