import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, RefundStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { toRefundResponse } from '../mappers/order.mapper';
import { RefundResponse } from '../types/order-response.types';
import { OrdersService } from './orders.service';

const REFUNDABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.COMPLETED,
  OrderStatus.PARTIALLY_REFUNDED,
];

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async create(
    orderId: string,
    user: AuthenticatedUser,
    dto: CreateRefundDto,
  ): Promise<RefundResponse> {
    const order = await this.ordersService.findEntityOrThrow(orderId);

    if (order.buyerId !== user.id) {
      throw new ForbiddenException('Only the buyer can request a refund');
    }

    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('This order is not eligible for a refund');
    }

    const alreadyProcessed = await this.prisma.refund.aggregate({
      where: { orderId, status: RefundStatus.PROCESSED },
      _sum: { amount: true },
    });

    const refundedSoFar = alreadyProcessed._sum.amount ?? 0;
    if (refundedSoFar + dto.amount > order.subtotal) {
      throw new BadRequestException(
        'Refund amount exceeds the remaining refundable balance',
      );
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        requestedById: user.id,
        amount: dto.amount,
        reason: dto.reason,
      },
    });

    return toRefundResponse(refund);
  }

  async findAll(
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<RefundResponse[]> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertParticipant(order, user);

    const refunds = await this.prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return refunds.map((refund) => toRefundResponse(refund));
  }

  async approve(
    orderId: string,
    refundId: string,
    user: AuthenticatedUser,
  ): Promise<RefundResponse> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertBrandOwnerOrAdmin(order, user);

    await this.findPendingRefundOrThrow(orderId, refundId);

    const processed = await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: RefundStatus.PROCESSED, processedAt: new Date() },
    });

    const totalRefunded = await this.prisma.refund.aggregate({
      where: { orderId, status: RefundStatus.PROCESSED },
      _sum: { amount: true },
    });

    const refundedAmount = totalRefunded._sum.amount ?? 0;
    const newStatus =
      refundedAmount >= order.subtotal
        ? OrderStatus.REFUNDED
        : OrderStatus.PARTIALLY_REFUNDED;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return toRefundResponse(processed);
  }

  async reject(
    orderId: string,
    refundId: string,
    user: AuthenticatedUser,
    dto: RejectRefundDto,
  ): Promise<RefundResponse> {
    const order = await this.ordersService.findEntityOrThrow(orderId);
    await this.ordersService.assertBrandOwnerOrAdmin(order, user);

    await this.findPendingRefundOrThrow(orderId, refundId);

    const rejected = await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: RefundStatus.REJECTED, rejectedReason: dto.reason },
    });

    return toRefundResponse(rejected);
  }

  private async findPendingRefundOrThrow(orderId: string, refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund || refund.orderId !== orderId) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new ConflictException('Only pending refunds can be decided');
    }

    return refund;
  }
}
