"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, type BadgeTone, Card, Chip, Eyebrow, KeyValue, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { brandsApi } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import {
  CART_MAX_QUANTITY,
  cartApi,
  ordersApi,
  type Order,
  type OrderStatus,
  type RefundStatus,
  type ShipmentStatus,
} from "@/lib/api/orders";
import { paymentsApi, type Payment } from "@/lib/api/payments";
import { queryKeys } from "@/lib/api/query-keys";
import { countryOptions } from "@/lib/utils/countries";
import { formatAmount, formatDate, formatMoney, formatRelative } from "@/lib/utils/format";
import { loadStripe, STRIPE_APPEARANCE, STRIPE_PUBLISHABLE_KEY, type StripeClient, type StripeElements } from "./stripe";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "warning" },
  PAID: { label: "Paid", tone: "accent" },
  FULFILLED: { label: "Shipped", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "info" },
};

const REFUND_STATUS: Record<RefundStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  REJECTED: { label: "Declined", tone: "danger" },
  PROCESSED: { label: "Refunded", tone: "accent" },
};

const SHIPMENT_STATUS: Record<ShipmentStatus, string> = {
  PENDING: "Label created",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
};

// Mirrors backend rules (UX only).
const CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "FULFILLED", "PARTIALLY_REFUNDED"];
const REFUNDABLE: OrderStatus[] = ["PAID", "FULFILLED", "COMPLETED", "PARTIALLY_REFUNDED"];
const SHIPPABLE: OrderStatus[] = ["PAID", "FULFILLED"];

/* ---------------------------------------------------------------- cart */

const EMPTY_ADDRESS = { name: "", line1: "", line2: "", city: "", postalCode: "", country: "IT" };

export function CartScreen() {
  const client = useQueryClient();
  const router = useRouter();
  const cart = useQuery({ queryKey: queryKeys.cart, queryFn: cartApi.get });
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const set = (key: keyof typeof EMPTY_ADDRESS) => (event: { target: { value: string } }) =>
    setAddress((current) => ({ ...current, [key]: event.target.value }));
  const addressValid = !!(address.name.trim() && address.line1.trim() && address.city.trim() && address.postalCode.trim());

  const update = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      quantity === 0 ? cartApi.remove(itemId) : cartApi.update(itemId, quantity),
    onSuccess: (updated) => client.setQueryData(queryKeys.cart, updated),
    onError: (error) => toast.error("Couldn't update your bag", apiMessage(error)),
  });
  const checkout = useMutation({
    mutationFn: () =>
      ordersApi.checkout(
        Object.fromEntries(Object.entries(address).filter(([, value]) => value.trim() !== "")) as Record<string, string>,
      ),
    onSuccess: (orders) => {
      void client.invalidateQueries({ queryKey: queryKeys.cart });
      void client.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success(orders.length > 1 ? `${orders.length} orders placed` : "Order placed", "Complete payment to confirm.");
      router.push(orders.length === 1 ? `/orders/${orders[0].id}` : "/orders");
    },
    onError: (error) => toast.error("Checkout failed", apiMessage(error)),
  });

  if (cart.isLoading) return <LoadingState />;
  if (cart.isError) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load your bag" onRetry={() => cart.refetch()} />
      </PageContainer>
    );
  }
  const items = cart.data?.items ?? [];
  if (items.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Bag" />
        <EmptyState
          icon={<ShoppingBag className="size-5" aria-hidden />}
          title="Your bag is empty"
          description="Discover products from brands on CollabOS."
          action={
            <Button asChild size="sm">
              <Link href="/explore">Explore brands</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg">
      <PageHeader title="Bag" subtitle={`${items.reduce((sum, item) => sum + item.quantity, 0)} items`} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="divide-y divide-border self-start">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-fg">{item.productName}</p>
                <p className="text-caption text-muted">
                  {item.sku} · {formatAmount(item.unitPrice)} each
                </p>
              </div>
              <div className="flex items-center rounded-md border border-border" role="group" aria-label={`Quantity of ${item.productName}`}>
                <IconButton variant="ghost" size="sm" label="Decrease quantity" disabled={update.isPending} onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity - 1 })}>
                  <Minus className="size-4" aria-hidden />
                </IconButton>
                <span className="tabular w-8 text-center text-body font-semibold">{item.quantity}</span>
                <IconButton
                  variant="ghost"
                  size="sm"
                  label="Increase quantity"
                  disabled={update.isPending || item.quantity >= CART_MAX_QUANTITY}
                  onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                >
                  <Plus className="size-4" aria-hidden />
                </IconButton>
              </div>
              <span className="tabular w-24 text-right text-body font-semibold text-fg">{formatAmount(item.lineTotal)}</span>
              <IconButton variant="ghost" size="sm" label={`Remove ${item.productName}`} onClick={() => update.mutate({ itemId: item.id, quantity: 0 })}>
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </div>
          ))}
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <Eyebrow>Shipping address</Eyebrow>
            <Field label="Full name">{({ id }) => <Input id={id} autoComplete="name" value={address.name} onChange={set("name")} />}</Field>
            <Field label="Address">{({ id }) => <Input id={id} autoComplete="address-line1" value={address.line1} onChange={set("line1")} />}</Field>
            <Field label="Apartment, suite" optional>
              {({ id }) => <Input id={id} autoComplete="address-line2" value={address.line2} onChange={set("line2")} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">{({ id }) => <Input id={id} autoComplete="address-level2" value={address.city} onChange={set("city")} />}</Field>
              <Field label="Postcode">{({ id }) => <Input id={id} autoComplete="postal-code" value={address.postalCode} onChange={set("postalCode")} />}</Field>
            </div>
            <Field label="Country">
              {({ id }) => (
                <Select id={id} autoComplete="country" value={address.country} onChange={set("country")}>
                  {countryOptions().map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Card>
          <Card className="p-5">
            <KeyValue label="Subtotal" value={formatAmount(cart.data?.total ?? 0)} />
            <p className="mt-2 text-caption text-muted">
              Amounts are in each brand&apos;s currency. One order is created per brand; you&apos;ll pay on the next step.
            </p>
            <Button className="mt-4" size="lg" fullWidth disabled={!addressValid} loading={checkout.isPending} onClick={() => checkout.mutate()}>
              Checkout
            </Button>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

/* ---------------------------------------------------------- order list */

function OrderRow({ order, perspective }: { order: Order; perspective: "buyer" | "seller" }) {
  const status = ORDER_STATUS[order.status];
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(order.brandId),
    queryFn: () => brandsApi.get(order.brandId),
    staleTime: 5 * 60_000,
    enabled: perspective === "buyer",
  });
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Link href={`/orders/${order.id}`} className="block">
      <Card interactive className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-body font-bold text-fg">
            {perspective === "buyer" ? (brand.data?.name ?? "Order") : `Order · ${order.id.slice(0, 8).toUpperCase()}`}
          </p>
          <p className="text-caption text-muted">
            {units} item{units === 1 ? "" : "s"} · {formatRelative(order.createdAt)}
          </p>
        </div>
        <span className="tabular text-body font-semibold text-fg">{formatMoney(order.subtotal, order.currency)}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card>
    </Link>
  );
}

export function OrdersList() {
  const session = useSession();
  const me = session.data?.id;
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  // The backend returns my purchases and my brands' sales together.
  const query = useQuery({
    queryKey: queryKeys.orders.list({ status, page }),
    queryFn: () => ordersApi.list({ status: status === "ALL" ? undefined : status, page, limit: 50 }),
  });
  const purchases = query.data?.data.filter((order) => order.buyerId === me) ?? [];
  const sales = query.data?.data.filter((order) => order.buyerId !== me) ?? [];

  const list = (orders: Order[], perspective: "buyer" | "seller") =>
    orders.length === 0 ? (
      <EmptyState
        icon={<ShoppingBag className="size-5" aria-hidden />}
        title={perspective === "buyer" ? "No purchases" : "No sales yet"}
        description={perspective === "buyer" ? "Orders you place appear here." : "Orders for your brand's products appear here."}
      />
    ) : (
      <ul className="flex flex-col gap-3">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderRow order={order} perspective={perspective} />
          </li>
        ))}
      </ul>
    );

  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/cart">
              <ShoppingBag className="size-4" aria-hidden /> Bag
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {(["ALL", "PENDING_PAYMENT", "PAID", "FULFILLED", "COMPLETED", "CANCELLED"] as const).map((value) => (
          <Chip
            key={value}
            selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value === "ALL" ? "All" : ORDER_STATUS[value].label}
          </Chip>
        ))}
      </div>
      {query.isLoading || session.isLoading ? (
        <SkeletonList count={4} />
      ) : query.isError ? (
        <ErrorState title="Couldn't load orders" onRetry={() => query.refetch()} />
      ) : (
        <Tabs defaultValue={sales.length > 0 && purchases.length === 0 ? "sales" : "purchases"}>
          <TabsList variant="segmented" className="mb-5">
            <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
            <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases">{list(purchases, "buyer")}</TabsContent>
          <TabsContent value="sales">{list(sales, "seller")}</TabsContent>
          <Pagination page={page} limit={50} total={query.data?.total ?? 0} onPageChange={setPage} className="mt-4" />
        </Tabs>
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------- payment */

function PaymentForm({ clientSecret, onPaid }: { clientSecret: string; onPaid: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{ stripe: StripeClient; elements: StripeElements } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    let element: { destroy: () => void } | null = null;
    loadStripe()
      .then((stripe) => {
        if (destroyed || !stripe || !container.current) return;
        const elements = stripe.elements({ clientSecret, appearance: STRIPE_APPEARANCE });
        const payment = elements.create("payment", { layout: "tabs" });
        payment.mount(container.current);
        element = payment;
        stripeRef.current = { stripe, elements };
        setState("ready");
      })
      .catch(() => !destroyed && setState("failed"));
    return () => {
      destroyed = true;
      element?.destroy();
    };
  }, [clientSecret]);

  const pay = async () => {
    if (!stripeRef.current) return;
    setSubmitting(true);
    setError(null);
    const { stripe, elements } = stripeRef.current;
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "Payment failed. Try another card.");
      return;
    }
    onPaid();
  };

  return (
    <div>
      <div ref={container} className="min-h-24" />
      {state === "loading" && <LoadingState label="Loading secure payment form" />}
      {state === "failed" && <p className="text-caption text-danger">The payment form couldn&apos;t load. Check your connection.</p>}
      {error && (
        <p role="alert" className="mt-3 text-caption text-danger">
          {error}
        </p>
      )}
      <Button className="mt-4" size="lg" fullWidth disabled={state !== "ready"} loading={submitting} onClick={pay}>
        Pay now
      </Button>
    </div>
  );
}

function PayPanel({ order }: { order: Order }) {
  const client = useQueryClient();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const start = useMutation({
    mutationFn: async () => {
      try {
        return await paymentsApi.forOrder(order.id);
      } catch (error) {
        // A payment was already started for this order: resume it.
        if (error instanceof ApiError && error.isConflict) {
          const existing = (await paymentsApi.mine()).find((item) => item.orderId === order.id);
          if (existing) return existing;
        }
        throw error;
      }
    },
    onSuccess: setPayment,
    onError: (error) =>
      toast.error(
        "Couldn't start payment",
        error instanceof ApiError && (error.isUnavailable || error.status >= 500)
          ? "Payments aren't available right now."
          : apiMessage(error),
      ),
  });

  // After Stripe confirms, the backend learns via webhook: poll the order
  // (event-driven, from the confirmation handler) until it leaves PENDING.
  const waitForSettlement = async () => {
    setConfirming(true);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const latest = await ordersApi.get(order.id).catch(() => null);
      if (latest && latest.status !== "PENDING_PAYMENT") {
        client.setQueryData(queryKeys.orders.detail(order.id), latest);
        void client.invalidateQueries({ queryKey: queryKeys.orders.all });
        toast.success("Payment received");
        return;
      }
    }
    setConfirming(false);
    toast.info("Payment is processing", "We'll update this order once it's confirmed.");
  };

  if (!STRIPE_PUBLISHABLE_KEY) {
    return (
      <Card className="p-5">
        <Eyebrow className="mb-2">Payment</Eyebrow>
        <p className="text-body text-fg-2">Card payments aren&apos;t configured in this environment.</p>
        <p className="mt-1 text-caption text-muted">The order stays reserved as awaiting payment.</p>
      </Card>
    );
  }

  return (
    <Card highlight className="p-5">
      <Eyebrow tone="accent" className="mb-3 flex items-center gap-1.5">
        <CreditCard className="size-3.5" aria-hidden /> Complete payment
      </Eyebrow>
      {confirming ? (
        <LoadingState label="Confirming payment" />
      ) : payment?.clientSecret ? (
        <PaymentForm clientSecret={payment.clientSecret} onPaid={() => void waitForSettlement()} />
      ) : (
        <Button size="lg" fullWidth loading={start.isPending} onClick={() => start.mutate()}>
          Pay {formatMoney(order.subtotal, order.currency)}
        </Button>
      )}
    </Card>
  );
}

/* --------------------------------------------------------- order detail */

function Refunds({ order, isBuyer, isSeller }: { order: Order; isBuyer: boolean; isSeller: boolean }) {
  const client = useQueryClient();
  const refunds = useQuery({ queryKey: queryKeys.orders.refunds(order.id), queryFn: () => ordersApi.refunds(order.id) });
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(order.subtotal));
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.orders.refunds(order.id) });
    void client.invalidateQueries({ queryKey: queryKeys.orders.detail(order.id) });
  };
  const amountValid = /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= order.subtotal;
  const request = useMutation({
    mutationFn: () => ordersApi.requestRefund(order.id, { amount: Number(amount), reason: reason.trim() }),
    onSuccess: () => {
      setOpen(false);
      toast.success("Refund requested");
      refresh();
    },
    onError: (error) => toast.error("Couldn't request a refund", apiMessage(error)),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? ordersApi.approveRefund(order.id, id) : ordersApi.rejectRefund(order.id, id, rejectReason.trim()),
    onSuccess: (_result, { approve }) => {
      setRejecting(null);
      toast.success(approve ? "Refund approved" : "Refund declined");
      refresh();
    },
    onError: (error) => toast.error("Couldn't update the refund", apiMessage(error)),
  });

  const hasItems = !!refunds.data && refunds.data.length > 0;
  if (!hasItems && !(isBuyer && REFUNDABLE.includes(order.status))) return null;

  return (
    <section>
      <SectionHeader title="Refunds" />
      {hasItems && (
        <Card className="mb-3 divide-y divide-border">
          {refunds.data!.map((refund) => (
            <div key={refund.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="tabular text-body font-semibold text-fg">{formatMoney(refund.amount, order.currency)}</span>
                <Badge tone={REFUND_STATUS[refund.status].tone}>{REFUND_STATUS[refund.status].label}</Badge>
              </div>
              <p className="mt-1 text-caption text-fg-2">{refund.reason}</p>
              {refund.rejectedReason && <p className="mt-1 text-caption text-danger">Declined: {refund.rejectedReason}</p>}
              {isSeller && refund.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" loading={decide.isPending && decide.variables?.id === refund.id && decide.variables.approve} onClick={() => decide.mutate({ id: refund.id, approve: true })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRejecting(refund.id)}>
                    Decline
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {isBuyer && REFUNDABLE.includes(order.status) && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Request a refund
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Request a refund"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!amountValid || reason.trim().length < 3} loading={request.isPending} onClick={() => request.mutate()}>
              Request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={`Amount (${order.currency})`} hint={`Up to ${formatMoney(order.subtotal, order.currency)}`} error={amount && !amountValid ? "Enter a whole amount within the order total" : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={amount} onChange={(event) => setAmount(event.target.value)} />
            )}
          </Field>
          <Field label="Reason">
            {({ id }) => <Textarea id={id} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
        </div>
      </Modal>
      <Modal
        open={!!rejecting}
        onOpenChange={(value) => !value && setRejecting(null)}
        title="Decline refund"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={rejectReason.trim().length < 3}
              loading={decide.isPending}
              onClick={() => rejecting && decide.mutate({ id: rejecting, approve: false })}
            >
              Decline
            </Button>
          </>
        }
      >
        <Field label="Reason shown to the buyer">
          {({ id }) => <Textarea id={id} rows={3} maxLength={500} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />}
        </Field>
      </Modal>
    </section>
  );
}

function Shipments({ order, isSeller }: { order: Order; isSeller: boolean }) {
  const client = useQueryClient();
  const shipments = useQuery({ queryKey: queryKeys.orders.shipments(order.id), queryFn: () => ordersApi.shipments(order.id) });
  const [form, setForm] = useState({ carrier: "", trackingNumber: "", trackingUrl: "" });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.orders.shipments(order.id) });
    void client.invalidateQueries({ queryKey: queryKeys.orders.detail(order.id) });
  };
  const urlValid = form.trackingUrl === "" || /^https:\/\//i.test(form.trackingUrl);
  const create = useMutation({
    mutationFn: () =>
      ordersApi.createShipment(order.id, {
        carrier: form.carrier.trim(),
        trackingNumber: form.trackingNumber.trim(),
        trackingUrl: form.trackingUrl.trim() || undefined,
      }),
    onSuccess: () => {
      setForm({ carrier: "", trackingNumber: "", trackingUrl: "" });
      toast.success("Shipment added");
      refresh();
    },
    onError: (error) => toast.error("Couldn't add the shipment", apiMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShipmentStatus }) => ordersApi.updateShipment(order.id, id, status),
    onSuccess: refresh,
    onError: (error) => toast.error("Couldn't update the shipment", apiMessage(error)),
  });

  const canShip = isSeller && SHIPPABLE.includes(order.status);
  if (!shipments.data?.length && !canShip) return null;

  return (
    <section>
      <SectionHeader title="Shipping" />
      {shipments.data && shipments.data.length > 0 && (
        <Card className="mb-3 divide-y divide-border">
          {shipments.data.map((shipment) => (
            <div key={shipment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Truck className="size-4 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-fg">
                  {shipment.carrier} · {shipment.trackingNumber}
                </p>
                {shipment.trackingUrl && /^https:\/\//i.test(shipment.trackingUrl) && (
                  <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-caption font-semibold text-accent">
                    Track package
                  </a>
                )}
              </div>
              {isSeller ? (
                <>
                  <label className="sr-only" htmlFor={`shipment-${shipment.id}`}>
                    Shipment status
                  </label>
                  <Select
                    id={`shipment-${shipment.id}`}
                    className="w-40"
                    value={shipment.status}
                    onChange={(event) => update.mutate({ id: shipment.id, status: event.target.value as ShipmentStatus })}
                  >
                    {(Object.keys(SHIPMENT_STATUS) as ShipmentStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {SHIPMENT_STATUS[status]}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <Badge tone={shipment.status === "DELIVERED" ? "accent" : "info"}>{SHIPMENT_STATUS[shipment.status]}</Badge>
              )}
            </div>
          ))}
        </Card>
      )}
      {canShip && (
        <Card className="p-4">
          <form
            className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.carrier.trim().length >= 2 && form.trackingNumber.trim().length >= 3 && urlValid) create.mutate();
            }}
          >
            <Input aria-label="Carrier" placeholder="Carrier" maxLength={60} value={form.carrier} onChange={(event) => setForm({ ...form, carrier: event.target.value })} />
            <Input aria-label="Tracking number" placeholder="Tracking number" maxLength={100} value={form.trackingNumber} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })} />
            <Input aria-label="Tracking link" aria-invalid={!urlValid || undefined} placeholder="https:// tracking link (optional)" maxLength={500} value={form.trackingUrl} onChange={(event) => setForm({ ...form, trackingUrl: event.target.value })} />
            <Button type="submit" size="sm" loading={create.isPending} disabled={form.carrier.trim().length < 2 || form.trackingNumber.trim().length < 3 || !urlValid}>
              Add shipment
            </Button>
          </form>
        </Card>
      )}
    </section>
  );
}

export function OrderScreen({ orderId }: { orderId: string }) {
  const client = useQueryClient();
  const session = useSession();
  const order = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => ordersApi.get(orderId),
    retry: (count, error) => !(error instanceof ApiError && (error.isForbidden || error.isNotFound)) && count < 2,
  });
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(order.data?.brandId ?? ""),
    queryFn: () => brandsApi.get(order.data!.brandId),
    enabled: !!order.data,
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderId, reason.trim() || undefined),
    onSuccess: (updated) => {
      setCancelOpen(false);
      client.setQueryData(queryKeys.orders.detail(orderId), updated);
      void client.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success("Order cancelled", "Reserved stock was released.");
    },
    onError: (error) => toast.error("Couldn't cancel", apiMessage(error)),
  });

  if (order.isLoading) return <LoadingState />;
  if (order.isError || !order.data) {
    const hidden = order.error instanceof ApiError && (order.error.isForbidden || order.error.isNotFound);
    return (
      <PageContainer>
        <BackLink href="/orders" />
        <ErrorState title={hidden ? "Order not found" : "Couldn't load this order"} onRetry={hidden ? undefined : () => order.refetch()} />
      </PageContainer>
    );
  }

  const data = order.data;
  const status = ORDER_STATUS[data.status];
  const isBuyer = data.buyerId === session.data?.id;
  const isSeller = !isBuyer && brand.data?.ownerId === session.data?.id;

  return (
    <PageContainer size="lg">
      <BackLink href="/orders" />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={status.tone}>{status.label}</Badge>
          <h1 className="mt-2 font-display text-title text-fg">Order {data.id.slice(0, 8).toUpperCase()}</h1>
          <p className="mt-1 text-body text-muted">
            {isBuyer ? `From ${brand.data?.name ?? "brand"}` : "Sale"} · placed {formatDate(data.createdAt, true)}
          </p>
        </div>
        {CANCELLABLE.includes(data.status) && (isBuyer || isSeller) && (
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Items" />
            <Card className="divide-y divide-border">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-fg">{item.productName}</p>
                    <p className="text-caption text-muted">
                      {item.sku} · {item.quantity} × {formatMoney(item.unitPrice, data.currency)}
                    </p>
                  </div>
                  <span className="tabular text-body font-semibold text-fg">{formatMoney(item.unitPrice * item.quantity, data.currency)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 text-body">
                <span className="text-muted">Total</span>
                <span className="tabular font-display text-heading text-fg">{formatMoney(data.subtotal, data.currency)}</span>
              </div>
            </Card>
          </section>
          <Shipments order={data} isSeller={isSeller} />
          <Refunds order={data} isBuyer={isBuyer} isSeller={isSeller} />
        </div>
        <aside className="flex flex-col gap-4">
          {isBuyer && data.status === "PENDING_PAYMENT" && <PayPanel order={data} />}
          {data.cancelReason && <p className="text-caption text-muted">Cancellation reason: {data.cancelReason}</p>}
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description="Reserved stock is released. Paid orders may need a refund."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel order
            </Button>
          </>
        }
      >
        <Field label="Reason" optional>
          {({ id }) => <Textarea id={id} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
      </Modal>
    </PageContainer>
  );
}
