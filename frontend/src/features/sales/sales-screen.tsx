"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/components/ui/bar-chart";
import { Badge, Card, Chip, Eyebrow, KeyValue, SectionHeader, Stat } from "@/components/ui/display";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { useSession } from "@/features/auth/hooks";
import { ORDER_STATUS } from "@/features/orders/order-screens";
import { useActiveBrand } from "@/features/brands/workspace";
import { insightsApi } from "@/lib/api/ai";
import { analyticsApi, type Granularity } from "@/lib/api/analytics";
import { ApiError } from "@/lib/api/http";
import type { OrderStatus } from "@/lib/api/orders";
import { queryKeys } from "@/lib/api/query-keys";
import { formatCompact, formatMoney } from "@/lib/utils/format";

const RANGES = [
  { days: 7, label: "7 days", granularity: "day" },
  { days: 30, label: "30 days", granularity: "day" },
  { days: 90, label: "90 days", granularity: "week" },
  { days: 365, label: "12 months", granularity: "month" },
] as const satisfies ReadonlyArray<{ days: number; label: string; granularity: Granularity }>;

function rangeFor(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function shortLabel(iso: string, granularity: Granularity): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", granularity === "month" ? { month: "short" } : { day: "numeric", month: "short" }).format(date);
}

export function SalesScreen() {
  const session = useSession();
  const { brand, isLoading } = useActiveBrand();
  const isOwner = !!brand && brand.ownerId === session.data?.id;
  const [rangeIndex, setRangeIndex] = useState(1);
  const range = RANGES[rangeIndex];
  // Snapshot the window when the range changes (not on every render).
  const [period, setPeriod] = useState(() => rangeFor(RANGES[1].days));
  const params = brand ? { brandId: brand.id, ...period } : null;

  const report = useQuery({
    queryKey: queryKeys.analytics.report({ ...params }),
    queryFn: () => analyticsApi.report(params!),
    enabled: !!params && isOwner,
  });
  const revenue = useQuery({
    queryKey: queryKeys.analytics.revenue({ ...params, granularity: range.granularity }),
    queryFn: () => analyticsApi.revenueChart({ ...params!, granularity: range.granularity }),
    enabled: !!params && isOwner,
  });
  const traffic = useQuery({
    queryKey: queryKeys.analytics.traffic({ ...params, granularity: range.granularity }),
    queryFn: () => analyticsApi.trafficChart({ ...params!, granularity: range.granularity }),
    enabled: !!params && isOwner,
  });
  const prediction = useQuery({
    queryKey: queryKeys.analytics.prediction(brand?.id ?? ""),
    queryFn: () => insightsApi.revenuePrediction(brand!.id),
    enabled: !!brand && isOwner,
    retry: false,
  });

  if (isLoading || session.isLoading) {
    return (
      <PageContainer size="lg">
        <SkeletonList count={4} />
      </PageContainer>
    );
  }
  if (!brand || !isOwner) {
    return (
      <PageContainer>
        <PageHeader title="Sales" />
        <EmptyState
          icon={<BarChart3 className="size-5" aria-hidden />}
          title="Sales analytics are for brand owners"
          description={brand ? `Ask the owner of ${brand.name} for a report.` : "Create a brand to see sales."}
        />
      </PageContainer>
    );
  }

  const data = report.data;
  const currency = data?.revenue.currency ?? "EUR";
  const money = (value: number) => formatMoney(value, currency);

  return (
    <PageContainer size="xl">
      <PageHeader
        title="Sales"
        subtitle={`Performance for ${brand.name}`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={analyticsApi.exportUrl({ brandId: brand.id, ...period })} download>
              <Download className="size-4" aria-hidden /> CSV
            </a>
          </Button>
        }
      />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Date range">
        {RANGES.map((option, index) => (
          <Chip
            key={option.days}
            selected={index === rangeIndex}
            onClick={() => {
              setRangeIndex(index);
              setPeriod(rangeFor(option.days));
            }}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {report.isError ? (
        <ErrorState title="Couldn't load analytics" onRetry={() => report.refetch()} />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat accent label="Revenue" value={data ? money(data.revenue.totalRevenue) : "–"} />
            <Stat label="Orders" value={data ? data.revenue.orderCount : "–"} />
            <Stat label="Avg. order" value={data ? money(data.revenue.averageOrderValue) : "–"} />
            <Stat label="Visitors" value={data ? formatCompact(data.visitors.uniqueVisitors) : "–"} />
            <Stat
              label="Conversion"
              value={data ? `${(data.conversion.conversionRate * 100).toFixed(1)}%` : "–"}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <SectionHeader title="Revenue" />
              {revenue.isLoading ? (
                <div className="skeleton h-40 rounded-md" />
              ) : revenue.data && revenue.data.some((point) => point.revenue > 0) ? (
                <BarChart
                  caption={`Revenue per ${range.granularity}`}
                  formatValue={money}
                  data={revenue.data.map((point) => ({ label: shortLabel(point.date, range.granularity), value: point.revenue }))}
                />
              ) : (
                <p className="py-12 text-center text-caption text-muted">No paid orders in this period.</p>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader title="Orders by status" />
              {data && data.orders.totalOrders > 0 ? (
                (Object.entries(data.orders.byStatus) as Array<[OrderStatus, number]>)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <KeyValue key={status} label={ORDER_STATUS[status]?.label ?? status} value={count} />
                  ))
              ) : (
                <p className="text-caption text-muted">No orders yet.</p>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader title="Traffic" />
              {traffic.isLoading ? (
                <div className="skeleton h-32 rounded-md" />
              ) : traffic.data && traffic.data.some((point) => point.views > 0) ? (
                <BarChart
                  height={120}
                  caption={`Page views per ${range.granularity}`}
                  formatValue={(value) => `${value} views`}
                  data={traffic.data.map((point) => ({ label: shortLabel(point.date, range.granularity), value: point.views }))}
                />
              ) : (
                <p className="py-8 text-center text-caption text-muted">No tracked page views in this period.</p>
              )}
            </Card>

            <Card highlight className="p-5">
              <Eyebrow tone="accent" className="mb-2 flex items-center gap-1.5">
                <Sparkles className="size-3" aria-hidden /> Revenue outlook
              </Eyebrow>
              {prediction.isLoading ? (
                <SkeletonList count={1} />
              ) : prediction.isError ? (
                <p className="text-caption text-muted">
                  {prediction.error instanceof ApiError && prediction.error.isRateLimited
                    ? "Too many requests — try again in a minute."
                    : "The outlook isn't available right now."}
                </p>
              ) : prediction.data ? (
                <>
                  <p className="flex items-center gap-2 font-display text-heading text-fg">
                    {prediction.data.trend === "down" ? (
                      <TrendingDown className="size-5 text-danger" aria-hidden />
                    ) : (
                      <TrendingUp className="size-5 text-accent" aria-hidden />
                    )}
                    Trending {prediction.data.trend}
                  </p>
                  {prediction.data.history.length + prediction.data.predicted.length > 0 && (
                    <BarChart
                      className="mt-4"
                      height={80}
                      caption="Revenue history and forecast"
                      formatValue={(value) => formatMoney(value, prediction.data!.currency)}
                      data={[
                        ...prediction.data.history.map((point) => ({ label: point.period, value: point.amount })),
                        ...prediction.data.predicted.map((point) => ({ label: point.period, value: point.amount, projected: true })),
                      ]}
                    />
                  )}
                  <p className="mt-3 text-caption text-fg-2">{prediction.data.narrative}</p>
                  {!prediction.data.generatedByAi && (
                    <Badge className="mt-3">Statistical estimate</Badge>
                  )}
                </>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
