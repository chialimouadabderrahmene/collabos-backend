import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisLockService } from '../../common/locking/redis-lock.service';
import { OutboxPublisherService } from '../../events/outbox-publisher.service';
import { OutboxService } from '../../events/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectService } from './connect.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { TransactionsService } from './transactions.service';
import { WebhookService } from './webhook.service';

function buildPayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'payment-1',
    payerId: 'buyer-1',
    amount: 120,
    currency: 'USD',
    status: 'REQUIRES_PAYMENT',
    ...overrides,
  };
}

describe('WebhookService', () => {
  let prisma: {
    payment: { update: ReturnType<typeof vi.fn> };
    webhookEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let stripeService: { constructWebhookEvent: ReturnType<typeof vi.fn> };
  let paymentsService: {
    findByStripePaymentIntentId: ReturnType<typeof vi.fn>;
  };
  let connectService: { syncFromStripeAccount: ReturnType<typeof vi.fn> };
  let transactionsService: { record: ReturnType<typeof vi.fn> };
  let redisLockService: { withLock: ReturnType<typeof vi.fn> };
  let outboxService: { enqueue: ReturnType<typeof vi.fn> };
  let outboxPublisherService: { scheduleDispatch: ReturnType<typeof vi.fn> };
  let service: WebhookService;

  beforeEach(() => {
    prisma = {
      payment: { update: vi.fn() },
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
      },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    stripeService = { constructWebhookEvent: vi.fn() };
    paymentsService = { findByStripePaymentIntentId: vi.fn() };
    connectService = {
      syncFromStripeAccount: vi.fn().mockResolvedValue(undefined),
    };
    transactionsService = { record: vi.fn().mockResolvedValue(undefined) };
    redisLockService = {
      withLock: vi.fn(
        async (_key: string, _ttl: number, fn: () => Promise<void>) => fn(),
      ),
    };
    outboxService = {
      enqueue: vi.fn().mockReturnValue(Promise.resolve({ id: 'outbox-1' })),
    };
    outboxPublisherService = {
      scheduleDispatch: vi.fn().mockResolvedValue(undefined),
    };
    service = new WebhookService(
      stripeService as unknown as StripeService,
      prisma as unknown as PrismaService,
      paymentsService as unknown as PaymentsService,
      connectService as unknown as ConnectService,
      transactionsService as unknown as TransactionsService,
      redisLockService as unknown as RedisLockService,
      outboxService as unknown as OutboxService,
      outboxPublisherService as unknown as OutboxPublisherService,
    );
  });

  describe('handle', () => {
    it('rejects a missing signature', async () => {
      await expect(
        service.handle(Buffer.from('{}'), undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(stripeService.constructWebhookEvent).not.toHaveBeenCalled();
    });

    it('rejects a signature Stripe fails to verify', async () => {
      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(
        service.handle(Buffer.from('{}'), 'bad-sig'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('marks the payment SUCCEEDED, enqueues an outbox event, and dispatches it', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });
      paymentsService.findByStripePaymentIntentId.mockResolvedValue(
        buildPayment(),
      );

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'SUCCEEDED' },
      });
      expect(outboxService.enqueue).toHaveBeenCalledWith({
        aggregateType: 'Payment',
        aggregateId: 'payment-1',
        eventType: 'payment.succeeded',
        payload: {
          paymentId: 'payment-1',
          payerId: 'buyer-1',
          amount: 120,
          currency: 'USD',
        },
      });
      expect(outboxPublisherService.scheduleDispatch).toHaveBeenCalledWith(
        'outbox-1',
      );
      expect(transactionsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CHARGE', amount: -120 }),
      );
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { source: 'stripe_payments', eventId: 'evt_1' },
      });
    });

    it('is idempotent for an already-succeeded payment', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_2',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });
      paymentsService.findByStripePaymentIntentId.mockResolvedValue(
        buildPayment({ status: 'SUCCEEDED' }),
      );

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(transactionsService.record).not.toHaveBeenCalled();
      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('skips reprocessing an already-recorded event id', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_3',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });
      prisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'row-1',
        source: 'stripe_payments',
        eventId: 'evt_3',
      });

      const result = await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(redisLockService.withLock).not.toHaveBeenCalled();
      expect(
        paymentsService.findByStripePaymentIntentId,
      ).not.toHaveBeenCalled();
    });

    it('does nothing when the lock is already held by another instance', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_4',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });
      redisLockService.withLock.mockResolvedValue(undefined);

      const result = await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(
        paymentsService.findByStripePaymentIntentId,
      ).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED on payment_intent.payment_failed', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_5',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_123' } },
      });
      paymentsService.findByStripePaymentIntentId.mockResolvedValue(
        buildPayment(),
      );

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'FAILED' },
      });
      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('delegates account.updated to ConnectService', async () => {
      const stripeAccount = { id: 'acct_123' };
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_6',
        type: 'account.updated',
        data: { object: stripeAccount },
      });

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(connectService.syncFromStripeAccount).toHaveBeenCalledWith(
        stripeAccount,
      );
    });

    it('ignores unhandled event types without throwing', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_7',
        type: 'charge.dispute.created',
        data: { object: {} },
      });

      await expect(
        service.handle(Buffer.from('{}'), 'valid-sig'),
      ).resolves.toEqual({ received: true });
    });
  });
});
