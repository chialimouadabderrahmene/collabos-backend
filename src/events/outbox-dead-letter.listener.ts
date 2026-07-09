import { OnQueueEvent, QueueEventsListener } from '@nestjs/bullmq';
import { QueueEventsHost } from '@nestjs/bullmq';
import { OutboxEventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OUTBOX_QUEUE } from './outbox-queue.constant';

/**
 * Fires once BullMQ has exhausted every retry attempt for a job (see
 * DEFAULT_JOB_OPTIONS). This is the single source of truth for marking an
 * OutboxEvent as dead-lettered — the processor only tracks per-attempt
 * state (attempts/lastError); this listener makes the terminal call.
 */
@QueueEventsListener(OUTBOX_QUEUE)
export class OutboxDeadLetterListener extends QueueEventsHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @OnQueueEvent('failed')
  async onFailed(args: { jobId: string; failedReason: string }): Promise<void> {
    const outboxEvent = await this.prisma.outboxEvent.findUnique({
      where: { id: args.jobId },
    });

    if (!outboxEvent) {
      // Not every failed job corresponds to an outbox row (e.g. the
      // repeatable poll job itself, whose jobId is a fixed string).
      return;
    }

    await this.prisma.outboxEvent.update({
      where: { id: outboxEvent.id },
      data: { status: OutboxEventStatus.FAILED, lastError: args.failedReason },
    });
  }
}
