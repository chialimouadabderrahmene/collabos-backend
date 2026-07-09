import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WriteOutboxEventParams {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns an un-awaited Prisma write, meant to be included alongside the
   * caller's own business-mutation write inside a single
   * `prisma.$transaction([...])` array. That's the entire outbox guarantee:
   * the event row commits atomically with the state change it describes, or
   * neither does.
   */
  enqueue(params: WriteOutboxEventParams) {
    return this.prisma.outboxEvent.create({
      data: {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  }
}
