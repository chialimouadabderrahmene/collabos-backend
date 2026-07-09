import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { POLL_OUTBOX_REPEAT_JOB_ID } from './outbox-queue.constant';

describe('OutboxPublisherService', () => {
  let queue: { add: ReturnType<typeof vi.fn> };
  let prisma: { outboxEvent: { findMany: ReturnType<typeof vi.fn> } };
  let service: OutboxPublisherService;

  beforeEach(() => {
    queue = { add: vi.fn().mockResolvedValue(undefined) };
    prisma = { outboxEvent: { findMany: vi.fn().mockResolvedValue([]) } };
    service = new OutboxPublisherService(
      queue as never,
      prisma as unknown as PrismaService,
    );
  });

  describe('onModuleInit', () => {
    it('registers the repeatable poll job with a stable jobId', async () => {
      await service.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        'poll-outbox',
        {},
        expect.objectContaining({
          jobId: POLL_OUTBOX_REPEAT_JOB_ID,
          repeat: { every: 30000 },
        }),
      );
    });
  });

  describe('scheduleDispatch', () => {
    it('enqueues a dispatch job keyed by the outbox event id', async () => {
      await service.scheduleDispatch('outbox-1');

      expect(queue.add).toHaveBeenCalledWith(
        'dispatch-outbox-event',
        { outboxEventId: 'outbox-1' },
        expect.objectContaining({ jobId: 'outbox-1' }),
      );
    });
  });

  describe('enqueuePendingBatch', () => {
    it('re-enqueues every pending event older than the grace period', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([
        { id: 'outbox-1' },
        { id: 'outbox-2' },
      ]);

      const count = await service.enqueuePendingBatch();

      expect(count).toBe(2);
      expect(queue.add).toHaveBeenCalledWith(
        'dispatch-outbox-event',
        { outboxEventId: 'outbox-1' },
        expect.objectContaining({ jobId: 'outbox-1' }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'dispatch-outbox-event',
        { outboxEventId: 'outbox-2' },
        expect.objectContaining({ jobId: 'outbox-2' }),
      );
    });

    it('returns 0 and enqueues nothing when there is no backlog', async () => {
      const count = await service.enqueuePendingBatch();

      expect(count).toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
