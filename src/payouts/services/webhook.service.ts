import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PayoutStatus, TransactionType } from '@prisma/client';
import type Stripe from 'stripe';
import { RedisLockService } from '../../common/locking/redis-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';

const WEBHOOK_SOURCE = 'stripe_payouts';
const LOCK_TTL_MS = 30000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly redisLockService: RedisLockService,
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
          case 'payout.paid':
            await this.updateStatus(event.data.object, PayoutStatus.PAID);
            break;
          case 'payout.failed':
            await this.updateStatus(event.data.object, PayoutStatus.FAILED);
            break;
          case 'payout.canceled':
            await this.updateStatus(event.data.object, PayoutStatus.CANCELED);
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

  private async updateStatus(
    stripePayout: Stripe.Payout,
    status: PayoutStatus,
  ): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { stripePayoutId: stripePayout.id },
    });

    if (!payout || payout.status === status) {
      return;
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status,
        failureReason:
          status === PayoutStatus.FAILED
            ? (stripePayout.failure_message ?? 'Payout failed')
            : payout.failureReason,
      },
    });

    if (status === PayoutStatus.FAILED || status === PayoutStatus.CANCELED) {
      await this.prisma.transaction.create({
        data: {
          userId: payout.userId,
          type: TransactionType.PAYOUT,
          amount: payout.amount,
          currency: payout.currency,
          description:
            status === PayoutStatus.FAILED
              ? 'Payout failed - funds returned to balance'
              : 'Payout canceled - funds returned to balance',
        },
      });
    }
  }
}
