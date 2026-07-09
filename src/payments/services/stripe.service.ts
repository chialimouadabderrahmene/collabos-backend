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

  getClient(): Stripe {
    return this.client;
  }

  async createConnectedAccount(email: string): Promise<Stripe.Account> {
    return this.client.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  async createAccountLink(
    stripeAccountId: string,
  ): Promise<Stripe.AccountLink> {
    return this.client.accountLinks.create({
      account: stripeAccountId,
      refresh_url: this.configService.get<string>('stripe.connectRefreshUrl'),
      return_url: this.configService.get<string>('stripe.connectReturnUrl'),
      type: 'account_onboarding',
    });
  }

  async retrieveAccount(stripeAccountId: string): Promise<Stripe.Account> {
    return this.client.accounts.retrieve(stripeAccountId);
  }

  // amount must be in the currency's smallest unit (e.g. cents for USD)
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    });
  }

  async retrievePaymentIntent(
    stripePaymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.retrieve(stripePaymentIntentId);
  }

  async createRefund(stripePaymentIntentId: string): Promise<Stripe.Refund> {
    return this.client.refunds.create({
      payment_intent: stripePaymentIntentId,
    });
  }

  // amount must be in the currency's smallest unit (e.g. cents for USD)
  async createTransfer(params: {
    amount: number;
    currency: string;
    destinationAccountId: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.Transfer> {
    return this.client.transfers.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      destination: params.destinationAccountId,
      metadata: params.metadata,
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      rawBody,
      signature,
      this.configService.get<string>('stripe.webhookSecret') as string,
    );
  }
}
