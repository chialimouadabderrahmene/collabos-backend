import { OutboxEvent } from '@prisma/client';
import { OutboxEventResponse } from '../types/outbox-event-response.types';

export function toOutboxEventResponse(event: OutboxEvent): OutboxEventResponse {
  return {
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    status: event.status,
    attempts: event.attempts,
    lastError: event.lastError,
    createdAt: event.createdAt,
    publishedAt: event.publishedAt,
  };
}
