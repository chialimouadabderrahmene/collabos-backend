import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventBus } from '@nestjs/cqrs';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventRegistry } from './domain-event-registry.service';
import {
  DISPATCH_OUTBOX_EVENT_JOB,
  DispatchOutboxEventJobData,
  OUTBOX_QUEUE,
  POLL_OUTBOX_JOB,
} from './outbox-queue.constant';
import { OutboxPublisherService } from './outbox-publisher.service';

@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly registry: DomainEventRegistry,
    private readonly outboxPublisherService: OutboxPublisherService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === POLL_OUTBOX_JOB) {
      await this.outboxPublisherService.enqueuePendingBatch();
      return;
    }

    if (job.name !== DISPATCH_OUTBOX_EVENT_JOB) {
      return;
    }

    const { outboxEventId } = job.data as DispatchOutboxEventJobData;

    const outboxEvent = await this.prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!outboxEvent || outboxEvent.status !== OutboxEventStatus.PENDING) {
      // Already published (or dead-lettered) — safe no-op. Covers the case
      // where the fast-path enqueue and the poller both scheduled this job.
      return;
    }

    try {
      const event = this.registry.create(
        outboxEvent.eventType,
        outboxEvent.payload as Record<string, unknown>,
      );

      if (!event) {
        throw new Error(
          `No handler registered for event type "${outboxEvent.eventType}"`,
        );
      }

      // Publishing hands the event to in-process subscribers and returns;
      // it does not await handler completion (that's how @nestjs/cqrs's
      // in-memory bus works). "PUBLISHED" here means "successfully handed
      // off to the event bus", not "every handler finished successfully" —
      // see the ADR for why, and UnhandledExceptionBus for handler-level
      // failure visibility.
      this.eventBus.publish(event);

      await this.prisma.outboxEvent.update({
        where: { id: outboxEvent.id },
        data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date() },
      });
    } catch (error) {
      await this.prisma.outboxEvent.update({
        where: { id: outboxEvent.id },
        data: {
          attempts: { increment: 1 },
          lastError: (error as Error).message,
        } satisfies Prisma.OutboxEventUpdateInput,
      });
      throw error;
    }
  }
}
