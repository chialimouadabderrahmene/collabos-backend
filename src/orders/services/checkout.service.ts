import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Order, OrderItem, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { toOrderResponse } from '../mappers/order.mapper';
import { OrderResponse } from '../types/order-response.types';

interface CartLineItem {
  variantId: string;
  sku: string;
  productName: string;
  brandId: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(userId: string, dto: CheckoutDto): Promise<OrderResponse[]> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const lineItems: CartLineItem[] = cart.items.map((item) => {
      const unitPrice =
        item.variant.priceOverride ?? item.variant.product.price;
      return {
        variantId: item.variantId,
        sku: item.variant.sku,
        productName: item.variant.product.name,
        brandId: item.variant.product.brandId,
        unitPrice,
        quantity: item.quantity,
        availableStock: item.variant.stockQuantity,
      };
    });

    for (const line of lineItems) {
      if (line.quantity > line.availableStock) {
        throw new ConflictException(
          `Insufficient stock for ${line.productName} (${line.sku})`,
        );
      }
    }

    const itemsByBrand = new Map<string, CartLineItem[]>();
    for (const line of lineItems) {
      const existing = itemsByBrand.get(line.brandId) ?? [];
      existing.push(line);
      itemsByBrand.set(line.brandId, existing);
    }

    const orders = await this.prisma.$transaction(async (tx) => {
      const createdOrders: (Order & { items: OrderItem[] })[] = [];

      for (const [brandId, lines] of itemsByBrand) {
        const subtotal = lines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0,
        );

        const order = await tx.order.create({
          data: {
            buyerId: userId,
            brandId,
            subtotal,
            shippingAddress: dto.shippingAddress as Prisma.InputJsonValue,
            items: {
              create: lines.map((line) => ({
                variantId: line.variantId,
                productName: line.productName,
                sku: line.sku,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
              })),
            },
          },
          include: { items: true },
        });

        for (const line of lines) {
          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: line.variantId },
          });

          if (variant.stockQuantity < line.quantity) {
            throw new ConflictException(
              `Insufficient stock for ${line.productName} (${line.sku})`,
            );
          }

          await tx.productVariant.update({
            where: { id: line.variantId },
            data: { stockQuantity: { decrement: line.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              variantId: line.variantId,
              type: StockMovementType.SALE,
              quantity: -line.quantity,
              reason: `Order ${order.id}`,
            },
          });
        }

        createdOrders.push(order);
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return createdOrders;
    });

    return orders.map((order) => toOrderResponse(order));
  }

  async restockOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return;
    }

    await this.prisma.$transaction([
      ...order.items.map((item) =>
        this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        }),
      ),
      ...order.items.map((item) =>
        this.prisma.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: StockMovementType.RETURN,
            quantity: item.quantity,
            reason: `Order ${orderId} cancelled`,
          },
        }),
      ),
    ]);
  }
}
