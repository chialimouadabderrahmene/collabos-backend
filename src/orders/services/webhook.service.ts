import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, RefundStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WebhookEventType,
  WebhookPayloadDto,
} from '../dto/webhook-payload.dto';
import { CheckoutService } from './checkout.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly secret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
  ) {
    this.secret = this.configService.get<string>(
      'orders.webhookSecret',
    ) as string;
  }

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): void {
    if (!signatureHeader) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', this.secret)
      .update(rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signatureHeader, 'hex');

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  async handleEvent(payload: WebhookPayloadDto): Promise<{ received: true }> {
    switch (payload.eventType) {
      case WebhookEventType.PAYMENT_SUCCEEDED:
        await this.handlePaymentSucceeded(payload.orderId);
        break;
      case WebhookEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(payload.orderId);
        break;
      case WebhookEventType.REFUND_PROCESSED:
        await this.handleRefundProcessed(payload.orderId, payload.refundId);
        break;
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(
        `Ignoring payment_succeeded for order ${orderId}: not pending payment`,
      );
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });
  }

  private async handlePaymentFailed(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.warn(
        `Ignoring payment_failed for order ${orderId}: not pending payment`,
      );
      return;
    }

    await this.checkoutService.restockOrder(orderId);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: 'Payment failed',
      },
    });
  }

  private async handleRefundProcessed(
    orderId: string,
    refundId?: string,
  ): Promise<void> {
    if (!refundId) {
      this.logger.warn('Ignoring refund_processed webhook without a refundId');
      return;
    }

    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (
      !refund ||
      refund.orderId !== orderId ||
      refund.status !== RefundStatus.PENDING
    ) {
      this.logger.warn(
        `Ignoring refund_processed for refund ${refundId}: not pending`,
      );
      return;
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    await this.prisma.refund.update({
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
  }
}
