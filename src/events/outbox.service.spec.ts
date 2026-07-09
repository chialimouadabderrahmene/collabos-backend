import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let prisma: { outboxEvent: { create: ReturnType<typeof vi.fn> } };
  let service: OutboxService;

  beforeEach(() => {
    prisma = {
      outboxEvent: { create: vi.fn().mockReturnValue('prisma-promise') },
    };
    service = new OutboxService(prisma as unknown as PrismaService);
  });

  describe('enqueue', () => {
    it('builds a create call composable inside the caller transaction array', () => {
      const result = service.enqueue({
        aggregateType: 'Payment',
        aggregateId: 'payment-1',
        eventType: 'payment.succeeded',
        payload: { amount: 120 },
      });

      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          aggregateType: 'Payment',
          aggregateId: 'payment-1',
          eventType: 'payment.succeeded',
          payload: { amount: 120 },
        },
      });
      // Returns whatever prisma.outboxEvent.create returns, un-awaited, so
      // the caller can drop it straight into their own $transaction([...]).
      expect(result).toBe('prisma-promise');
    });
  });
});
