import { http, type Paginated } from "./http";

export type PaymentStatus = "REQUIRES_PAYMENT" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";
export type SplitStatus = "PENDING" | "RELEASED" | "FAILED" | "REFUNDED";
export type ConnectAccountStatus = "PENDING" | "ACTIVE" | "RESTRICTED" | "REJECTED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID";
export type TransactionType = "CHARGE" | "TRANSFER" | "REFUND" | "PLATFORM_FEE" | "PAYOUT";
export type PayoutStatus = "PENDING" | "IN_TRANSIT" | "PAID" | "FAILED" | "CANCELED";

export interface PaymentSplit {
  id: string;
  recipientUserId: string | null;
  isPlatformFee: boolean;
  amount: number;
  status: SplitStatus;
  releasedAt: string | null;
}

export interface Payment {
  id: string;
  payerId: string;
  orderId: string | null;
  dealId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  /**
   * Stripe PaymentIntent client secret. Only ever handed to Stripe.js to
   * confirm the payment; never logged, stored or put in a URL.
   */
  clientSecret: string | null;
  splits: PaymentSplit[];
  createdAt: string;
}

export interface ConnectAccount {
  id: string;
  status: ConnectAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface Invoice {
  id: string;
  paymentId: string;
  invoiceNumber: string;
  issuedToId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  pdfAvailable: boolean;
  issuedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  paymentId: string | null;
  description: string;
  createdAt: string;
}

export interface Balance {
  available: number;
  pendingWithdrawals: number;
  totalWithdrawn: number;
  totalEarned: number;
  currency: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface Transfer {
  id: string;
  paymentId: string;
  amount: number;
  stripeTransferId: string | null;
  releasedAt: string | null;
}

export interface PayoutReport {
  periodFrom: string | null;
  periodTo: string | null;
  totalEarned: number;
  totalWithdrawn: number;
  payoutCount: number;
  currency: string;
}

export const paymentsApi = {
  forOrder: (orderId: string) => http.post<Payment>("payments/orders", { orderId }),
  forDeal: (dealId: string) => http.post<Payment>("payments/deals", { dealId }),
  mine: () => http.get<Payment[]>("payments"),
  get: (id: string) => http.get<Payment>(`payments/${id}`),
  refund: (id: string) => http.post<Payment>(`payments/${id}/refund`),

  connectStatus: () => http.get<ConnectAccount>("payments/connect/status"),
  /** Returns a Stripe-hosted onboarding URL (navigated to, never stored). */
  connectOnboard: () => http.post<{ url: string }>("payments/connect/onboard"),

  invoices: () => http.get<Invoice[]>("payments/invoices"),
  createInvoice: (paymentId: string) => http.post<Invoice>(`payments/invoices/${paymentId}`),
  invoicePdfUrl: (id: string) => `/api/backend/payments/invoices/${id}/pdf`,

  transactions: (query: { page?: number; limit?: number; type?: TransactionType } = {}) =>
    http.get<Paginated<Transaction>>("payments/transactions", { ...query }),
};

export const payoutsApi = {
  balance: () => http.get<Balance>("payouts/balance"),
  /** Omit amount to withdraw the full available balance. */
  withdraw: (amount?: number) => http.post<Payout>("payouts/withdraw", { amount }),
  list: (query: { page?: number; limit?: number; status?: PayoutStatus } = {}) =>
    http.get<Paginated<Payout>>("payouts", { ...query }),
  transfers: (query: { page?: number; limit?: number } = {}) =>
    http.get<Paginated<Transfer>>("payouts/transfers", { ...query }),
  report: (query: { from?: string; to?: string } = {}) => http.get<PayoutReport>("payouts/reports/summary", { ...query }),
};
