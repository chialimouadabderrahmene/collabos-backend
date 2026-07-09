import { Injectable, Logger } from '@nestjs/common';
import { IEvent } from '@nestjs/cqrs';

export type DomainEventFactory = (payload: Record<string, unknown>) => IEvent;

/**
 * Maps a stored OutboxEvent's `eventType` string back to a concrete,
 * publishable domain event instance. Each module that raises domain events
 * registers its own event types here (e.g. in its module constructor);
 * this keeps the outbox publisher generic and decoupled from any single
 * module's event classes.
 */
@Injectable()
export class DomainEventRegistry {
  private readonly logger = new Logger(DomainEventRegistry.name);
  private readonly factories = new Map<string, DomainEventFactory>();

  register(eventType: string, factory: DomainEventFactory): void {
    this.factories.set(eventType, factory);
  }

  create(eventType: string, payload: Record<string, unknown>): IEvent | null {
    const factory = this.factories.get(eventType);

    if (!factory) {
      this.logger.warn(`No domain event registered for type "${eventType}"`);
      return null;
    }

    return factory(payload);
  }

  has(eventType: string): boolean {
    return this.factories.has(eventType);
  }
}
