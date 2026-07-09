import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly client: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.client = new Stripe(
      this.configService.get<string>('stripe.secretKey') as string,
    );
  }

  // amount must be in the currency's smallest unit (e.g. cents for USD)
  async createPayout(params: {
    amount: number;
    currency: string;
    stripeAccountId: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.Payout> {
    return this.client.payouts.create(
      {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        metadata: params.metadata,
      },
      { stripeAccount: params.stripeAccountId },
    );
  }

  async retrievePayout(
    stripePayoutId: string,
    stripeAccountId: string,
  ): Promise<Stripe.Payout> {
    return this.client.payouts.retrieve(stripePayoutId, undefined, {
      stripeAccount: stripeAccountId,
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      rawBody,
      signature,
      this.configService.get<string>('payouts.webhookSecret') as string,
    );
  }
}
