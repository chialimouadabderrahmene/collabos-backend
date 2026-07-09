import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderItem, OrderStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { ListOrdersQueryDto } from '../dto/list-orders-query.dto';
import { toOrderResponse } from '../mappers/order.mapper';
import {
  OrderResponse,
  PaginatedOrdersResponse,
} from '../types/order-response.types';
import { CheckoutService } from './checkout.service';

const NON_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
  ) {}

  async findMine(
    user: AuthenticatedUser,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedOrdersResponse> {
    const ownedBrandIds = await this.prisma.brand.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    const where: Prisma.OrderWhereInput = {
      OR: [
        { buyerId: user.id },
        { brandId: { in: ownedBrandIds.map((brand) => brand.id) } },
      ],
      ...(query.status ? { status: query.status } : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => toOrderResponse(order)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OrderResponse> {
    const order = await this.findEntityOrThrow(id);
    await this.assertParticipant(order, user);

    return toOrderResponse(order);
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelOrderDto,
  ): Promise<OrderResponse> {
    const order = await this.findEntityOrThrow(id);
    await this.assertParticipant(order, user);

    if (NON_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('This order can no longer be cancelled');
    }

    await this.checkoutService.restockOrder(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
      include: { items: true },
    });

    return toOrderResponse(updated);
  }

  async findEntityOrThrow(id: string): Promise<Order & { items: OrderItem[] }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async assertParticipant(
    order: Order,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (order.buyerId === user.id || user.roles.includes('ADMIN')) {
      return;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: order.brandId },
    });

    if (brand?.ownerId === user.id) {
      return;
    }

    throw new ForbiddenException('You do not have access to this order');
  }

  async assertBrandOwnerOrAdmin(
    order: Order,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.roles.includes('ADMIN')) {
      return;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: order.brandId },
    });

    if (brand?.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }
}
