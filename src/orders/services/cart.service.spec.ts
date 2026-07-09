import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from './cart.service';

function buildVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'variant-1',
    sku: 'NOIR-M-BLK',
    priceOverride: null,
    stockQuantity: 10,
    isActive: true,
    product: {
      id: 'product-1',
      name: 'Noir Bomber Jacket',
      price: 12000,
      isActive: true,
    },
    ...overrides,
  };
}

function buildCartItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item-1',
    cartId: 'cart-1',
    variantId: 'variant-1',
    quantity: 1,
    variant: buildVariant(),
    ...overrides,
  };
}

describe('CartService', () => {
  let prisma: {
    cart: { upsert: ReturnType<typeof vi.fn> };
    cartItem: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    productVariant: { findUnique: ReturnType<typeof vi.fn> };
  };
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { upsert: vi.fn() },
      cartItem: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      productVariant: { findUnique: vi.fn() },
    };
    service = new CartService(prisma as unknown as PrismaService);
  });

  describe('addItem', () => {
    it('throws NotFoundException for a missing or inactive variant', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem('user-1', { variantId: 'variant-1', quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('increments quantity when the item is already in the cart', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(buildVariant());
      prisma.cart.upsert.mockResolvedValue({
        id: 'cart-1',
        items: [buildCartItem()],
      });
      prisma.cartItem.findUnique.mockResolvedValue(
        buildCartItem({ quantity: 2 }),
      );

      await service.addItem('user-1', { variantId: 'variant-1', quantity: 3 });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 5 },
      });
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });

    it('creates a new cart item when none exists yet', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(buildVariant());
      prisma.cart.upsert.mockResolvedValue({ id: 'cart-1', items: [] });
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await service.addItem('user-1', { variantId: 'variant-1', quantity: 2 });

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: { cartId: 'cart-1', variantId: 'variant-1', quantity: 2 },
      });
    });
  });

  describe('updateItem / removeItem', () => {
    it('rejects a cart item belonging to another user', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({
        ...buildCartItem(),
        cart: { userId: 'someone-else' },
      });

      await expect(
        service.updateItem('user-1', 'item-1', { quantity: 2 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('updates the quantity for an owned item', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({
        ...buildCartItem(),
        cart: { userId: 'user-1' },
      });
      prisma.cart.upsert.mockResolvedValue({ id: 'cart-1', items: [] });

      await service.updateItem('user-1', 'item-1', { quantity: 4 });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 4 },
      });
    });
  });

  describe('clear', () => {
    it('deletes all items for the cart', async () => {
      prisma.cart.upsert.mockResolvedValue({ id: 'cart-1', items: [] });

      await service.clear('user-1');

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });
  });
});
