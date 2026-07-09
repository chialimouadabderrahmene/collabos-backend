import {
  ConnectedAccount,
  Invoice,
  Payment,
  PaymentSplit,
  Transaction,
} from '@prisma/client';
import {
  ConnectAccountResponse,
  InvoiceResponse,
  PaymentResponse,
  PaymentSplitResponse,
  TransactionResponse,
} from '../types/payment-response.types';

export function toConnectAccountResponse(
  account: ConnectedAccount,
): ConnectAccountResponse {
  return {
    id: account.id,
    status: account.status,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    detailsSubmitted: account.detailsSubmitted,
  };
}

export function toPaymentSplitResponse(
  split: PaymentSplit,
): PaymentSplitResponse {
  return {
    id: split.id,
    recipientUserId: split.recipientUserId,
    isPlatformFee: split.isPlatformFee,
    amount: split.amount,
    status: split.status,
    releasedAt: split.releasedAt,
  };
}

export function toPaymentResponse(
  payment: Payment & { splits: PaymentSplit[] },
): PaymentResponse {
  return {
    id: payment.id,
    payerId: payment.payerId,
    orderId: payment.orderId,
    dealId: payment.dealId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    clientSecret: payment.clientSecret,
    splits: payment.splits.map((split) => toPaymentSplitResponse(split)),
    createdAt: payment.createdAt,
  };
}

export function toInvoiceResponse(invoice: Invoice): InvoiceResponse {
  return {
    id: invoice.id,
    paymentId: invoice.paymentId,
    invoiceNumber: invoice.invoiceNumber,
    issuedToId: invoice.issuedToId,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    pdfAvailable: !!invoice.pdfFilename,
    issuedAt: invoice.issuedAt,
  };
}

export function toTransactionResponse(
  transaction: Transaction,
): TransactionResponse {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    paymentId: transaction.paymentId,
    description: transaction.description,
    createdAt: transaction.createdAt,
  };
}
