import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AuditAction, Prisma } from '@prisma/client';
import { DomainEventRegistry } from '../../events/domain-event-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PAYMENT_SUCCEEDED_EVENT_TYPE,
  PaymentSucceededEvent,
  PaymentSucceededPayload,
} from './payment-succeeded.event';

/**
 * Reference domain-event handler: reacts to a payment succeeding by writing
 * an audit trail entry. Deliberately does not throw — see the outbox ADR:
 * the in-process EventBus does not propagate handler exceptions back to the
 * publisher, so handlers must fail closed (log and move on) rather than
 * rely on outbox retry to fix a handler-side problem. Recovery for a
 * missed side effect is a manual replay (see ReplayService), which is why
 * this handler's effect (an audit row keyed by paymentId) is safe to run
 * more than once.
 */
@Injectable()
@EventsHandler(PaymentSucceededEvent)
export class PaymentSucceededHandler implements IEventHandler<PaymentSucceededEvent> {
  private readonly logger = new Logger(PaymentSucceededHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    registry: DomainEventRegistry,
  ) {
    registry.register(
      PAYMENT_SUCCEEDED_EVENT_TYPE,
      (payload) =>
        new PaymentSucceededEvent(
          payload as unknown as PaymentSucceededPayload,
        ),
    );
  }

  async handle(event: PaymentSucceededEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.payload.payerId,
          action: AuditAction.PAYMENT_SUCCEEDED,
          metadata: {
            paymentId: event.payload.paymentId,
            amount: event.payload.amount,
            currency: event.payload.currency,
          } satisfies Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit entry for payment ${event.payload.paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
