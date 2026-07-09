import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisLockService } from '../../common/locking/redis-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { WebhookService } from './webhook.service';

function buildPayout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'payout-1',
    userId: 'user-1',
    stripePayoutId: 'po_123',
    amount: 300,
    currency: 'USD',
    status: 'PENDING',
    failureReason: null,
    ...overrides,
  };
}

describe('WebhookService', () => {
  let prisma: {
    payout: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    transaction: { create: ReturnType<typeof vi.fn> };
    webhookEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let stripeService: { constructWebhookEvent: ReturnType<typeof vi.fn> };
  let redisLockService: { withLock: ReturnType<typeof vi.fn> };
  let service: WebhookService;

  beforeEach(() => {
    prisma = {
      payout: { findUnique: vi.fn(), update: vi.fn() },
      transaction: { create: vi.fn() },
      webhookEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
      },
    };
    stripeService = { constructWebhookEvent: vi.fn() };
    redisLockService = {
      withLock: vi.fn(
        async (_key: string, _ttl: number, fn: () => Promise<void>) => fn(),
      ),
    };
    service = new WebhookService(
      stripeService as unknown as StripeService,
      prisma as unknown as PrismaService,
      redisLockService as unknown as RedisLockService,
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

    it('marks the payout PAID', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payout.paid',
        data: { object: { id: 'po_123' } },
      });
      prisma.payout.findUnique.mockResolvedValue(buildPayout());

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: { status: 'PAID', failureReason: null },
      });
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { source: 'stripe_payouts', eventId: 'evt_1' },
      });
    });

    it('is idempotent when the payout already has the target status', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_2',
        type: 'payout.paid',
        data: { object: { id: 'po_123' } },
      });
      prisma.payout.findUnique.mockResolvedValue(
        buildPayout({ status: 'PAID' }),
      );

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payout.update).not.toHaveBeenCalled();
    });

    it('skips reprocessing an already-recorded event id', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_3',
        type: 'payout.paid',
        data: { object: { id: 'po_123' } },
      });
      prisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'row-1',
        source: 'stripe_payouts',
        eventId: 'evt_3',
      });

      const result = await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(redisLockService.withLock).not.toHaveBeenCalled();
      expect(prisma.payout.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing when the lock is already held by another instance', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_4',
        type: 'payout.paid',
        data: { object: { id: 'po_123' } },
      });
      redisLockService.withLock.mockResolvedValue(undefined);

      const result = await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(result).toEqual({ received: true });
      expect(prisma.payout.findUnique).not.toHaveBeenCalled();
    });

    it('marks the payout FAILED and reverses the balance with a ledger entry', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_5',
        type: 'payout.failed',
        data: { object: { id: 'po_123', failure_message: 'account closed' } },
      });
      prisma.payout.findUnique.mockResolvedValue(buildPayout());

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: { status: 'FAILED', failureReason: 'account closed' },
      });

      const transactionCall = prisma.transaction.create.mock.calls[0][0] as {
        data: { userId: string; type: string; amount: number };
      };
      expect(transactionCall.data).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          type: 'PAYOUT',
          amount: 300,
        }),
      );
    });

    it('marks the payout CANCELED and reverses the balance', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_6',
        type: 'payout.canceled',
        data: { object: { id: 'po_123' } },
      });
      prisma.payout.findUnique.mockResolvedValue(buildPayout());

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: { status: 'CANCELED', failureReason: null },
      });
      expect(prisma.transaction.create).toHaveBeenCalled();
    });

    it('ignores an event for an unknown payout', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_7',
        type: 'payout.paid',
        data: { object: { id: 'po_unknown' } },
      });
      prisma.payout.findUnique.mockResolvedValue(null);

      await service.handle(Buffer.from('{}'), 'valid-sig');

      expect(prisma.payout.update).not.toHaveBeenCalled();
    });

    it('ignores unhandled event types without throwing', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        id: 'evt_8',
        type: 'account.updated',
        data: { object: {} },
      });

      await expect(
        service.handle(Buffer.from('{}'), 'valid-sig'),
      ).resolves.toEqual({ received: true });
    });
  });
});
