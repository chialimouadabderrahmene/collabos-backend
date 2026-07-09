import { Payout, PaymentSplit } from '@prisma/client';
import {
  PayoutResponse,
  TransferResponse,
} from '../types/payout-response.types';

export function toPayoutResponse(payout: Payout): PayoutResponse {
  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status,
    failureReason: payout.failureReason,
    createdAt: payout.createdAt,
  };
}

export function toTransferResponse(split: PaymentSplit): TransferResponse {
  return {
    id: split.id,
    paymentId: split.paymentId,
    amount: split.amount,
    stripeTransferId: split.stripeTransferId,
    releasedAt: split.releasedAt,
  };
}
