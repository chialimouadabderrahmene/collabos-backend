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
  /** Whole-unit price in `currency`, from the product/variant — never assumed. */
  unitPrice: number;
  /** ISO 4217 code from the product catalog (`Product.currency`). */
  currency: string;
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
        // The product's own currency is the source of truth. Never fall
        // back to USD or any other default — Prisma would otherwise apply
        // the schema default silently when this is left unset.
        currency: item.variant.product.currency,
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

    // Each order is charged and paid out in a single currency. The current
    // catalog model allows a brand's products to be priced in different
    // currencies, so verify the cart doesn't require silently mixing them
    // (or worse, converting) into one order.
    for (const [brandId, lines] of itemsByBrand) {
      const currencies = new Set(lines.map((line) => line.currency));
      if (currencies.size > 1) {
        throw new BadRequestException(
          `Cannot check out items priced in different currencies (${[...currencies].join(', ')}) in the same order for brand ${brandId}`,
        );
      }
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
            // Safe: every line in `lines` was verified above to share one
            // currency, so the first line's currency applies to the order.
            currency: lines[0].currency,
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
