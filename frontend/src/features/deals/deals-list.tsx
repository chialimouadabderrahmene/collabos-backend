"use client";

import { useQuery } from "@tanstack/react-query";
import { Handshake, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip } from "@/components/ui/display";
import { EmptyState, ErrorState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applicationsApi, type Application } from "@/lib/api/applications";
import { briefsApi } from "@/lib/api/briefs";
import { dealsApi, type Deal, type DealStatus } from "@/lib/api/deals";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils/format";
import { APPLICATION_STATUS, DEAL_HEALTH, DEAL_STATUS } from "./status";

const FILTERS: Array<{ value: DealStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "NEGOTIATING", label: "Negotiating" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function DealRow({ deal }: { deal: Deal }) {
  const status = DEAL_STATUS[deal.status];
  const health = DEAL_HEALTH[deal.health];
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <Card interactive className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-body font-bold text-fg">{deal.title}</h3>
            <p className="mt-0.5 text-caption text-muted">
              {deal.endDate ? `Ends ${formatDate(deal.endDate)}` : `Opened ${formatRelative(deal.createdAt)}`}
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-caption">
          <span className="tabular font-display text-heading text-fg">
            {deal.totalValue !== null ? formatMoney(deal.totalValue, deal.currency) : "Terms pending"}
          </span>
          {deal.status === "ACTIVE" && (
            <Badge tone={health.tone} dot>
              {health.label}
            </Badge>
          )}
          {deal.revenueSplitBrand !== null && deal.revenueSplitCreator !== null && (
            <span className="tabular text-muted">
              Split {deal.revenueSplitBrand}/{deal.revenueSplitCreator}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  const brief = useQuery({
    queryKey: queryKeys.briefs.detail(application.briefId),
    queryFn: () => briefsApi.get(application.briefId),
    staleTime: 5 * 60_000,
  });
  const status = APPLICATION_STATUS[application.status];
  return (
    <Link href={`/briefs/${application.briefId}`} className="block">
      <Card interactive className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-body font-bold text-fg">
            {brief.data?.title ?? (brief.isLoading ? "Loading brief…" : "Brief")}
          </h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-caption text-muted">{application.coverMessage}</p>
        <p className="mt-2 text-caption text-faint">Sent {formatRelative(application.createdAt)}</p>
      </Card>
    </Link>
  );
}

function MyApplications() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.applications.mine({ page }),
    queryFn: () => applicationsApi.mine({ page, limit: 10 }),
  });
  if (query.isLoading) return <SkeletonList count={3} />;
  if (query.isError) return <ErrorState title="Couldn't load your proposals" onRetry={() => query.refetch()} />;
  if (!query.data || query.data.data.length === 0) {
    return (
      <EmptyState
        title="No proposals sent"
        description="Browse open briefs and send a proposal to start a deal."
        action={
          <Link href="/explore" className="text-body font-semibold text-accent">
            Browse briefs
          </Link>
        }
      />
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {query.data.data.map((application) => (
          <li key={application.id}>
            <ApplicationRow application={application} />
          </li>
        ))}
      </ul>
      <Pagination page={page} limit={10} total={query.data.total} onPageChange={setPage} className="mt-4" />
    </>
  );
}

export function DealsList() {
  const [status, setStatus] = useState<DealStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.deals.list({ status, page }),
    queryFn: () => dealsApi.list({ status: status === "ALL" ? undefined : status, page, limit: 10 }),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Deals"
        subtitle="Negotiations and active collaborations"
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/briefs/new">
              <Plus className="size-4" aria-hidden /> Post brief
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="deals">
        <TabsList variant="segmented" className="mb-5">
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="proposals">My proposals</TabsTrigger>
        </TabsList>
        <TabsContent value="deals">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
            {FILTERS.map((filter) => (
              <Chip
                key={filter.value}
                selected={status === filter.value}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </Chip>
            ))}
          </div>
          {query.isLoading ? (
            <SkeletonList count={4} />
          ) : query.isError ? (
            <ErrorState title="Couldn't load deals" onRetry={() => query.refetch()} />
          ) : !query.data || query.data.data.length === 0 ? (
            <EmptyState
              icon={<Handshake className="size-5" aria-hidden />}
              title={status === "ALL" ? "No deals yet" : "Nothing here"}
              description="Deals start when a brand accepts a proposal on one of its briefs."
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {query.data.data.map((deal) => (
                  <li key={deal.id}>
                    <DealRow deal={deal} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} limit={10} total={query.data.total} onPageChange={setPage} className="mt-4" />
            </>
          )}
        </TabsContent>
        <TabsContent value="proposals">
          <MyApplications />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
