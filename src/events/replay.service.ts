import { EventBus } from '@nestjs/cqrs';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventRegistry } from './domain-event-registry.service';

export interface ReplaySummary {
  attempted: number;
  republished: number;
  skipped: number;
}

@Injectable()
export class ReplayService {
  private readonly logger = new Logger(ReplayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly registry: DomainEventRegistry,
  ) {}

  /**
   * Re-publishes a single stored event by id, regardless of its current
   * status. This does NOT mutate the stored row (no new publishedAt, no
   * status change) — it's a side channel for recovery/backfill, not a
   * re-run of the original delivery attempt. Handlers MUST be idempotent:
   * replay offers at-least-once redelivery, nothing stronger.
   */
  async replayById(id: string): Promise<boolean> {
    const outboxEvent = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });

    if (!outboxEvent) {
      throw new NotFoundException('Outbox event not found');
    }

    return this.publish(outboxEvent);
  }

  async replaySince(
    since: Date,
    status?: OutboxEventStatus,
  ): Promise<ReplaySummary> {
    const where: Prisma.OutboxEventWhereInput = {
      createdAt: { gte: since },
      ...(status ? { status } : {}),
    };

    const events = await this.prisma.outboxEvent.findMany({ where });

    let republished = 0;
    for (const event of events) {
      const ok = this.publish(event);
      if (ok) {
        republished += 1;
      }
    }

    return {
      attempted: events.length,
      republished,
      skipped: events.length - republished,
    };
  }

  private publish(outboxEvent: {
    id: string;
    eventType: string;
    payload: Prisma.JsonValue;
  }): boolean {
    const event = this.registry.create(
      outboxEvent.eventType,
      outboxEvent.payload as Record<string, unknown>,
    );

    if (!event) {
      this.logger.warn(
        `Cannot replay outbox event ${outboxEvent.id}: no handler registered for type "${outboxEvent.eventType}"`,
      );
      return false;
    }

    this.eventBus.publish(event);
    this.logger.log(`Replayed outbox event ${outboxEvent.id}`);
    return true;
  }
}
