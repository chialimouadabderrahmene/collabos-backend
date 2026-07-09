import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS } from '../common/queue/job-options.constant';
import { PrismaService } from '../prisma/prisma.service';
import {
  DISPATCH_OUTBOX_EVENT_JOB,
  OUTBOX_QUEUE,
  POLL_GRACE_PERIOD_MS,
  POLL_INTERVAL_MS,
  POLL_OUTBOX_JOB,
  POLL_OUTBOX_REPEAT_JOB_ID,
} from './outbox-queue.constant';

@Injectable()
export class OutboxPublisherService implements OnModuleInit {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Repeatable safety-net job: idempotent to register on every boot since
    // BullMQ dedupes repeatable jobs by their (name, repeat options, jobId).
    await this.queue.add(
      POLL_OUTBOX_JOB,
      {},
      {
        jobId: POLL_OUTBOX_REPEAT_JOB_ID,
        repeat: { every: POLL_INTERVAL_MS },
      },
    );
  }

  /** Fast path: call right after the caller's transaction (business write +
   * outbox row) commits. Usually dispatches within milliseconds. */
  async scheduleDispatch(outboxEventId: string): Promise<void> {
    await this.queue.add(
      DISPATCH_OUTBOX_EVENT_JOB,
      { outboxEventId },
      { ...DEFAULT_JOB_OPTIONS, jobId: outboxEventId },
    );
  }

  /** Safety net: catches events whose fast-path enqueue never happened
   * (e.g. process crash between commit and scheduleDispatch). Re-enqueuing
   * with the same jobId is a harmless no-op if it's already queued. */
  async enqueuePendingBatch(): Promise<number> {
    const cutoff = new Date(Date.now() - POLL_GRACE_PERIOD_MS);

    const pending = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING, createdAt: { lte: cutoff } },
      select: { id: true },
      take: 100,
    });

    for (const event of pending) {
      await this.scheduleDispatch(event.id);
    }

    if (pending.length > 0) {
      this.logger.log(
        `Outbox poll re-enqueued ${pending.length} pending event(s)`,
      );
    }

    return pending.length;
  }
}
