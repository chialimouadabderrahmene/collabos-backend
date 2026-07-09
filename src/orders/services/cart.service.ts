import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { toCartResponse } from '../mappers/order.mapper';
import { CartResponse } from '../types/order-response.types';

const CART_ITEM_INCLUDE = {
  items: {
    include: { variant: { include: { product: true } } },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: CART_ITEM_INCLUDE,
    });

    return toCartResponse(cart.id, cart.items);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponse> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });

    if (!variant || !variant.isActive || !variant.product.isActive) {
      throw new NotFoundException('Product variant not found');
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + dto.quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getOrCreate(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponse> {
    const item = await this.findItemOrThrow(userId, itemId);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.getOrCreate(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const item = await this.findItemOrThrow(userId, itemId);

    await this.prisma.cartItem.delete({ where: { id: item.id } });

    return this.getOrCreate(userId);
  }

  async clear(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return this.getOrCreate(userId);
  }

  private async findItemOrThrow(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }
}
