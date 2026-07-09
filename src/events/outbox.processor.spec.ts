import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventRegistry } from './domain-event-registry.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OutboxProcessor } from './outbox.processor';

function buildJob(name: string, data: Record<string, unknown> = {}) {
  return { name, data } as never;
}

describe('OutboxProcessor', () => {
  let prisma: {
    outboxEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let registry: { create: ReturnType<typeof vi.fn> };
  let outboxPublisherService: { enqueuePendingBatch: ReturnType<typeof vi.fn> };
  let processor: OutboxProcessor;

  beforeEach(() => {
    prisma = {
      outboxEvent: { findUnique: vi.fn(), update: vi.fn() },
    };
    eventBus = { publish: vi.fn() };
    registry = { create: vi.fn() };
    outboxPublisherService = {
      enqueuePendingBatch: vi.fn().mockResolvedValue(0),
    };
    processor = new OutboxProcessor(
      prisma as unknown as PrismaService,
      eventBus as never,
      registry as unknown as DomainEventRegistry,
      outboxPublisherService as unknown as OutboxPublisherService,
    );
  });

  describe('process', () => {
    it('delegates poll jobs to the publisher service', async () => {
      await processor.process(buildJob('poll-outbox'));

      expect(outboxPublisherService.enqueuePendingBatch).toHaveBeenCalledTimes(
        1,
      );
      expect(prisma.outboxEvent.findUnique).not.toHaveBeenCalled();
    });

    it('ignores unrelated job names', async () => {
      await processor.process(buildJob('some-other-job'));

      expect(prisma.outboxEvent.findUnique).not.toHaveBeenCalled();
    });

    it('is a no-op when the outbox row no longer exists', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);

      await processor.process(
        buildJob('dispatch-outbox-event', { outboxEventId: 'outbox-1' }),
      );

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('is a no-op when the row is already published (idempotent)', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue({
        id: 'outbox-1',
        status: 'PUBLISHED',
      });

      await processor.process(
        buildJob('dispatch-outbox-event', { outboxEventId: 'outbox-1' }),
      );

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes the resolved event and marks the row PUBLISHED', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue({
        id: 'outbox-1',
        status: 'PENDING',
        eventType: 'payment.succeeded',
        payload: { paymentId: 'p1' },
      });
      const fakeEvent = { type: 'payment.succeeded' };
      registry.create.mockReturnValue(fakeEvent);

      await processor.process(
        buildJob('dispatch-outbox-event', { outboxEventId: 'outbox-1' }),
      );

      expect(eventBus.publish).toHaveBeenCalledWith(fakeEvent);

      const call = prisma.outboxEvent.update.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string; publishedAt: Date };
      };
      expect(call.where).toEqual({ id: 'outbox-1' });
      expect(call.data.status).toBe('PUBLISHED');
      expect(call.data.publishedAt).toBeInstanceOf(Date);
    });

    it('records the error and rethrows when no event is registered for the type', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue({
        id: 'outbox-1',
        status: 'PENDING',
        eventType: 'unknown.type',
        payload: {},
      });
      registry.create.mockReturnValue(null);

      await expect(
        processor.process(
          buildJob('dispatch-outbox-event', { outboxEventId: 'outbox-1' }),
        ),
      ).rejects.toThrow('No handler registered for event type "unknown.type"');

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'outbox-1' },
        data: {
          attempts: { increment: 1 },
          lastError: 'No handler registered for event type "unknown.type"',
        },
      });
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
});
