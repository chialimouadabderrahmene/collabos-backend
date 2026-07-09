import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxQueryService } from './outbox-query.service';

function buildEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'outbox-1',
    aggregateType: 'Payment',
    aggregateId: 'payment-1',
    eventType: 'payment.succeeded',
    status: 'PUBLISHED',
    attempts: 0,
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedAt: new Date('2026-01-01T00:00:01.000Z'),
    ...overrides,
  };
}

describe('OutboxQueryService', () => {
  let prisma: {
    outboxEvent: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: OutboxQueryService;

  beforeEach(() => {
    prisma = {
      outboxEvent: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new OutboxQueryService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns a paginated, mapped list filtered by status', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([buildEvent()]);
      prisma.outboxEvent.count.mockResolvedValue(1);

      const result = await service.list({
        page: 1,
        limit: 20,
        status: 'PUBLISHED',
      });

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('outbox-1');
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing event', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the mapped event when found', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(buildEvent());

      const result = await service.findOneOrThrow('outbox-1');

      expect(result.eventType).toBe('payment.succeeded');
    });
  });
});
