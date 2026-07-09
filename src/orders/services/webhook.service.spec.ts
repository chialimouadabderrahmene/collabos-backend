import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookEventType } from '../dto/webhook-payload.dto';
import { CheckoutService } from './checkout.service';
import { WebhookService } from './webhook.service';

const SECRET = 'a-very-long-test-webhook-secret';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

describe('WebhookService', () => {
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    refund: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
  };
  let checkoutService: { restockOrder: ReturnType<typeof vi.fn> };
  let service: WebhookService;

  beforeEach(() => {
    const configService = { get: vi.fn().mockReturnValue(SECRET) };
    prisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      refund: { findUnique: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    };
    checkoutService = { restockOrder: vi.fn().mockResolvedValue(undefined) };
    service = new WebhookService(
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
      checkoutService as unknown as CheckoutService,
    );
  });

  describe('verifySignature', () => {
    it('rejects a missing signature', () => {
      expect(() =>
        service.verifySignature(Buffer.from('{}'), undefined),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a tampered signature', () => {
      const body = '{"eventType":"payment_succeeded"}';
      expect(() =>
        service.verifySignature(Buffer.from(body), sign('different-body')),
      ).toThrow(UnauthorizedException);
    });

    it('accepts a valid signature', () => {
      const body = '{"eventType":"payment_succeeded"}';
      expect(() =>
        service.verifySignature(Buffer.from(body), sign(body)),
      ).not.toThrow();
    });
  });

  describe('handleEvent', () => {
    it('marks a pending-payment order as PAID on payment_succeeded', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'PENDING_PAYMENT',
      });

      await service.handleEvent({
        eventType: WebhookEventType.PAYMENT_SUCCEEDED,
        orderId: 'order-1',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'PAID' },
      });
    });

    it('ignores payment_succeeded for an order that is not pending payment (idempotent)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'PAID',
      });

      await service.handleEvent({
        eventType: WebhookEventType.PAYMENT_SUCCEEDED,
        orderId: 'order-1',
      });

      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('restocks and cancels the order on payment_failed', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'PENDING_PAYMENT',
      });

      await service.handleEvent({
        eventType: WebhookEventType.PAYMENT_FAILED,
        orderId: 'order-1',
      });

      expect(checkoutService.restockOrder).toHaveBeenCalledWith('order-1');
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date) as Date,
          cancelReason: 'Payment failed',
        },
      });
    });

    it('does not double-count the just-processed refund when computing the order status', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        orderId: 'order-1',
        status: 'PENDING',
        amount: 5000,
      });
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        subtotal: 5000,
      });
      // Aggregate already reflects the just-updated PROCESSED refund (5000),
      // since the update happens before this aggregate query runs.
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });

      await service.handleEvent({
        eventType: WebhookEventType.REFUND_PROCESSED,
        orderId: 'order-1',
        refundId: 'refund-1',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('ignores refund_processed for a refund that is not pending', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'refund-1',
        orderId: 'order-1',
        status: 'PROCESSED',
        amount: 5000,
      });

      await service.handleEvent({
        eventType: WebhookEventType.REFUND_PROCESSED,
        orderId: 'order-1',
        refundId: 'refund-1',
      });

      expect(prisma.refund.update).not.toHaveBeenCalled();
    });
  });
});
