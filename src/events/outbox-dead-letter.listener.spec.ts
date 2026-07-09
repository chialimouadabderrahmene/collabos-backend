import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxDeadLetterListener } from './outbox-dead-letter.listener';

describe('OutboxDeadLetterListener', () => {
  let prisma: {
    outboxEvent: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let listener: OutboxDeadLetterListener;

  beforeEach(() => {
    prisma = {
      outboxEvent: { findUnique: vi.fn(), update: vi.fn() },
    };
    listener = new OutboxDeadLetterListener(prisma as unknown as PrismaService);
  });

  describe('onFailed', () => {
    it('marks the matching outbox event FAILED once retries are exhausted', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue({ id: 'outbox-1' });

      await listener.onFailed({ jobId: 'outbox-1', failedReason: 'boom' });

      expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'outbox-1' },
        data: { status: 'FAILED', lastError: 'boom' },
      });
    });

    it('does nothing for a failed job with no matching outbox row', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);

      await listener.onFailed({
        jobId: 'poll-outbox-repeat',
        failedReason: 'boom',
      });

      expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
    });
  });
});
