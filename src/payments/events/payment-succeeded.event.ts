import { IEvent } from '@nestjs/cqrs';

export const PAYMENT_SUCCEEDED_EVENT_TYPE = 'payment.succeeded';

export interface PaymentSucceededPayload {
  paymentId: string;
  payerId: string;
  amount: number;
  currency: string;
}

export class PaymentSucceededEvent implements IEvent {
  constructor(public readonly payload: PaymentSucceededPayload) {}
}
