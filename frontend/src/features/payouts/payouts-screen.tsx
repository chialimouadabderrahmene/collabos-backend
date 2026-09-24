"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Landmark, Wallet } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone, Card, Eyebrow, KeyValue, Stat } from "@/components/ui/display";
import { EmptyState, ErrorState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";
import {
  paymentsApi,
  payoutsApi,
  type ConnectAccountStatus,
  type PayoutStatus,
  type TransactionType,
} from "@/lib/api/payments";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney } from "@/lib/utils/format";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  IN_TRANSIT: { label: "In transit", tone: "info" },
  PAID: { label: "Paid", tone: "accent" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELED: { label: "Cancelled", tone: "neutral" },
};

const CONNECT_STATUS: Record<ConnectAccountStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Setup incomplete", tone: "warning" },
  ACTIVE: { label: "Active", tone: "accent" },
  RESTRICTED: { label: "Restricted", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const TRANSACTION_COPY: Record<TransactionType, string> = {
  CHARGE: "Charge",
  TRANSFER: "Transfer",
  REFUND: "Refund",
  PLATFORM_FEE: "Platform fee",
  PAYOUT: "Payout",
};

/** Only follow onboarding links to Stripe over HTTPS. */
function isStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "stripe.com" || parsed.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
}

function PayoutAccount() {
  const connect = useQuery({
    queryKey: queryKeys.payments.connect,
    queryFn: paymentsApi.connectStatus,
    retry: false,
  });
  const onboard = useMutation({
    mutationFn: paymentsApi.connectOnboard,
    onSuccess: ({ url }) => {
      if (isStripeUrl(url)) {
        window.location.assign(url);
      } else {
        toast.error("Unexpected onboarding link", "Please contact support.");
      }
    },
    onError: (error) => toast.error("Couldn't start setup", apiMessage(error) ?? "Payouts aren't available right now."),
  });
  const notConnected = connect.error instanceof ApiError && connect.error.isNotFound;
  const status = connect.data ? CONNECT_STATUS[connect.data.status] : null;

  return (
    <Card className="p-5">
      <Eyebrow className="mb-3 flex items-center gap-1.5">
        <Landmark className="size-3.5" aria-hidden /> Payout account
      </Eyebrow>
      {connect.isLoading ? (
        <SkeletonList count={1} />
      ) : connect.data && status ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-body text-fg">Stripe Connect</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <KeyValue label="Payouts" value={connect.data.payoutsEnabled ? "Enabled" : "Not enabled"} />
          <KeyValue label="Details" value={connect.data.detailsSubmitted ? "Submitted" : "Missing"} />
          {!connect.data.detailsSubmitted && (
            <Button className="mt-4" size="sm" loading={onboard.isPending} onClick={() => onboard.mutate()}>
              Continue setup
            </Button>
          )}
        </>
      ) : notConnected ? (
        <>
          <p className="text-body text-fg-2">Connect a bank account to receive your earnings.</p>
          <Button className="mt-4" size="sm" loading={onboard.isPending} onClick={() => onboard.mutate()}>
            Set up payouts
          </Button>
          <p className="mt-2 text-caption text-muted">You&apos;ll finish securely on Stripe.</p>
        </>
      ) : (
        <p className="text-caption text-muted">Payout accounts aren&apos;t available right now.</p>
      )}
    </Card>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  available,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available: number;
  currency: string;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState("");
  const valid = amount === "" || (/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) <= available);
  const withdraw = useMutation({
    mutationFn: () => payoutsApi.withdraw(amount === "" ? undefined : Number(amount)),
    onSuccess: (payout) => {
      onOpenChange(false);
      setAmount("");
      toast.success("Withdrawal requested", `${formatMoney(payout.amount, payout.currency)} is on its way.`);
      void client.invalidateQueries({ queryKey: ["payouts"] });
    },
    onError: (error) => toast.error("Couldn't withdraw", apiMessage(error)),
  });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Withdraw to bank"
      description={`Available: ${formatMoney(available, currency)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
            Withdraw
          </Button>
        </>
      }
    >
      <Field label="Amount" optional hint="Leave empty to withdraw everything available." error={!valid ? "Enter an amount up to your available balance" : undefined}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={amount} onChange={(event) => setAmount(event.target.value)} />
        )}
      </Field>
    </Modal>
  );
}

function PayoutHistory() {
  const [page, setPage] = useState(1);
  const payouts = useQuery({ queryKey: queryKeys.payouts.list({ page }), queryFn: () => payoutsApi.list({ page, limit: 10 }) });
  if (payouts.isLoading) return <SkeletonList count={3} />;
  if (payouts.isError) return <ErrorState title="Couldn't load payouts" onRetry={() => payouts.refetch()} />;
  if (!payouts.data?.data.length) return <EmptyState title="No withdrawals yet" />;
  return (
    <>
      <Card className="divide-y divide-border">
        {payouts.data.data.map((payout) => (
          <div key={payout.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="tabular text-body font-semibold text-fg">{formatMoney(payout.amount, payout.currency)}</p>
              <p className="text-caption text-muted">{formatDate(payout.createdAt, true)}</p>
              {payout.failureReason && <p className="text-caption text-danger">{payout.failureReason}</p>}
            </div>
            <Badge tone={PAYOUT_STATUS[payout.status].tone}>{PAYOUT_STATUS[payout.status].label}</Badge>
          </div>
        ))}
      </Card>
      <Pagination page={page} limit={10} total={payouts.data.total} onPageChange={setPage} className="mt-4" />
    </>
  );
}

function Transactions() {
  const [page, setPage] = useState(1);
  const transactions = useQuery({
    queryKey: queryKeys.payments.transactions({ page }),
    queryFn: () => paymentsApi.transactions({ page, limit: 15 }),
  });
  if (transactions.isLoading) return <SkeletonList count={3} />;
  if (transactions.isError) return <ErrorState title="Couldn't load transactions" onRetry={() => transactions.refetch()} />;
  if (!transactions.data?.data.length) return <EmptyState title="No transactions yet" />;
  return (
    <>
      <Card className="divide-y divide-border">
        {transactions.data.data.map((transaction) => (
          <div key={transaction.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-fg">{transaction.description}</p>
              <p className="text-caption text-muted">
                {TRANSACTION_COPY[transaction.type]} · {formatDate(transaction.createdAt)}
              </p>
            </div>
            <span className={`tabular text-body font-semibold ${transaction.amount < 0 ? "text-fg-2" : "text-accent"}`}>
              {formatMoney(transaction.amount, transaction.currency)}
            </span>
          </div>
        ))}
      </Card>
      <Pagination page={page} limit={15} total={transactions.data.total} onPageChange={setPage} className="mt-4" />
    </>
  );
}

function Invoices() {
  const invoices = useQuery({ queryKey: queryKeys.payments.invoices, queryFn: paymentsApi.invoices });
  if (invoices.isLoading) return <SkeletonList count={3} />;
  if (invoices.isError) return <ErrorState title="Couldn't load invoices" onRetry={() => invoices.refetch()} />;
  if (!invoices.data?.length) return <EmptyState title="No invoices yet" description="Invoices are issued for succeeded payments." />;
  return (
    <Card className="divide-y divide-border">
      {invoices.data.map((invoice) => (
        <div key={invoice.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-fg">{invoice.invoiceNumber}</p>
            <p className="text-caption text-muted">{formatDate(invoice.issuedAt)}</p>
          </div>
          <span className="tabular text-body text-fg-2">{formatMoney(invoice.amount, invoice.currency)}</span>
          {invoice.pdfAvailable && (
            <a href={paymentsApi.invoicePdfUrl(invoice.id)} className="rounded-md p-1.5 text-accent hover:bg-surface-2" aria-label={`Download invoice ${invoice.invoiceNumber}`}>
              <Download className="size-4" aria-hidden />
            </a>
          )}
        </div>
      ))}
    </Card>
  );
}

export function PayoutsScreen() {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const balance = useQuery({ queryKey: queryKeys.payouts.balance, queryFn: payoutsApi.balance });
  const data = balance.data;

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Payouts"
        subtitle="Earnings from deals and sales"
        actions={
          <Button size="sm" disabled={!data || data.available <= 0} onClick={() => setWithdrawOpen(true)}>
            <Wallet className="size-4" aria-hidden /> Withdraw
          </Button>
        }
      />
      {balance.isError ? (
        <ErrorState title="Couldn't load your balance" onRetry={() => balance.refetch()} />
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat accent label="Available" value={data ? formatMoney(data.available, data.currency) : "–"} />
          <Stat label="Pending withdrawals" value={data ? formatMoney(data.pendingWithdrawals, data.currency) : "–"} />
          <Stat label="Total earned" value={data ? formatMoney(data.totalEarned, data.currency) : "–"} />
          <Stat label="Total withdrawn" value={data ? formatMoney(data.totalWithdrawn, data.currency) : "–"} />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs defaultValue="payouts">
          <TabsList className="mb-5">
            <TabsTrigger value="payouts">Withdrawals</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="payouts">
            <PayoutHistory />
          </TabsContent>
          <TabsContent value="transactions">
            <Transactions />
          </TabsContent>
          <TabsContent value="invoices">
            <Invoices />
          </TabsContent>
        </Tabs>
        <aside>
          <PayoutAccount />
        </aside>
      </div>

      {data && (
        <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} available={data.available} currency={data.currency} />
      )}
    </PageContainer>
  );
}
