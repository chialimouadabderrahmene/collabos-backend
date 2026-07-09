import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventRegistry } from './domain-event-registry.service';
import { ReplayService } from './replay.service';

function buildOutboxEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'outbox-1',
    aggregateType: 'Payment',
    aggregateId: 'payment-1',
    eventType: 'payment.succeeded',
    payload: { paymentId: 'payment-1' },
    status: 'PUBLISHED',
    ...overrides,
  };
}

describe('ReplayService', () => {
  let prisma: {
    outboxEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let registry: { create: ReturnType<typeof vi.fn> };
  let service: ReplayService;

  beforeEach(() => {
    prisma = {
      outboxEvent: { findUnique: vi.fn(), findMany: vi.fn() },
    };
    eventBus = { publish: vi.fn() };
    registry = { create: vi.fn() };
    service = new ReplayService(
      prisma as unknown as PrismaService,
      eventBus as never,
      registry as unknown as DomainEventRegistry,
    );
  });

  describe('replayById', () => {
    it('throws NotFoundException for a missing event', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);

      await expect(service.replayById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('republishes an already-published event without mutating it', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(buildOutboxEvent());
      const fakeEvent = { type: 'payment.succeeded' };
      registry.create.mockReturnValue(fakeEvent);

      const result = await service.replayById('outbox-1');

      expect(result).toBe(true);
      expect(eventBus.publish).toHaveBeenCalledWith(fakeEvent);
    });

    it('returns false when no handler is registered for the event type', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(buildOutboxEvent());
      registry.create.mockReturnValue(null);

      const result = await service.replayById('outbox-1');

      expect(result).toBe(false);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('replaySince', () => {
    it('replays every matching event and summarizes the outcome', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        buildOutboxEvent({ id: 'outbox-1' }),
        buildOutboxEvent({ id: 'outbox-2', eventType: 'unknown.type' }),
      ]);
      registry.create.mockImplementation((eventType: string) =>
        eventType === 'unknown.type' ? null : { type: eventType },
      );

      const summary = await service.replaySince(new Date('2026-01-01'));

      expect(summary).toEqual({ attempted: 2, republished: 1, skipped: 1 });
    });

    it('filters by status when provided', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([]);

      await service.replaySince(new Date('2026-01-01'), 'FAILED');

      const call = prisma.outboxEvent.findMany.mock.calls[0][0] as {
        where: { status?: string };
      };
      expect(call.where.status).toBe('FAILED');
    });
  });
});
