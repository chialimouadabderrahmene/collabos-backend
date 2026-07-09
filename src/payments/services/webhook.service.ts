import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PaymentStatus, TransactionType } from '@prisma/client';
import type Stripe from 'stripe';
import { RedisLockService } from '../../common/locking/redis-lock.service';
import { OutboxPublisherService } from '../../events/outbox-publisher.service';
import { OutboxService } from '../../events/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_SUCCEEDED_EVENT_TYPE } from '../events/payment-succeeded.event';
import { ConnectService } from './connect.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { TransactionsService } from './transactions.service';

const WEBHOOK_SOURCE = 'stripe_payments';
const LOCK_TTL_MS = 30000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly connectService: ConnectService,
    private readonly transactionsService: TransactionsService,
    private readonly redisLockService: RedisLockService,
    private readonly outboxService: OutboxService,
    private readonly outboxPublisherService: OutboxPublisherService,
  ) {}

  async handle(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    if (await this.alreadyProcessed(event.id)) {
      this.logger.log(`Ignoring already-processed Stripe event ${event.id}`);
      return { received: true };
    }

    await this.redisLockService.withLock(
      `webhook:${WEBHOOK_SOURCE}:${event.id}`,
      LOCK_TTL_MS,
      async () => {
        if (await this.alreadyProcessed(event.id)) {
          return;
        }

        switch (event.type) {
          case 'payment_intent.succeeded':
            await this.handlePaymentSucceeded(event.data.object);
            break;
          case 'payment_intent.payment_failed':
            await this.handlePaymentFailed(event.data.object);
            break;
          case 'account.updated':
            await this.connectService.syncFromStripeAccount(event.data.object);
            break;
          default:
            this.logger.log(`Ignoring unhandled Stripe event: ${event.type}`);
        }

        await this.prisma.webhookEvent.create({
          data: { source: WEBHOOK_SOURCE, eventId: event.id },
        });
      },
    );

    return { received: true };
  }

  private async alreadyProcessed(eventId: string): Promise<boolean> {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { source_eventId: { source: WEBHOOK_SOURCE, eventId } },
    });

    return existing !== null;
  }

  private async handlePaymentSucceeded(
    intent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentsService.findByStripePaymentIntentId(
      intent.id,
    );

    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }

    const [, outboxEvent] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED },
      }),
      this.outboxService.enqueue({
        aggregateType: 'Payment',
        aggregateId: payment.id,
        eventType: PAYMENT_SUCCEEDED_EVENT_TYPE,
        payload: {
          paymentId: payment.id,
          payerId: payment.payerId,
          amount: payment.amount,
          currency: payment.currency,
        },
      }),
    ]);

    // Fast path: best-effort immediate dispatch. If this call is lost (e.g.
    // the process crashes right here), the outbox poller's safety net picks
    // it up within POLL_INTERVAL_MS — the transaction above is what
    // actually guarantees the event is never lost, not this call.
    await this.outboxPublisherService.scheduleDispatch(outboxEvent.id);

    await this.transactionsService.record({
      userId: payment.payerId,
      type: TransactionType.CHARGE,
      amount: -payment.amount,
      currency: payment.currency,
      paymentId: payment.id,
      description: 'Payment charged',
    });
  }

  private async handlePaymentFailed(
    intent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentsService.findByStripePaymentIntentId(
      intent.id,
    );

    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
  }
}
