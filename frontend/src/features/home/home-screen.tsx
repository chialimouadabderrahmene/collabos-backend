"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Compass,
  Handshake,
  MessageCircle,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { PageContainer } from "@/components/navigation/page";
import { Badge, Card, Eyebrow, SectionHeader, Stat } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton, SkeletonList } from "@/components/ui/feedback";
import { useActiveBrand } from "@/features/brands/workspace";
import { useOpportunities, useOpportunityCount } from "@/features/opportunities/hooks";
import { dealsApi } from "@/lib/api/deals";
import { notificationsApi } from "@/lib/api/notifications";
import { cn } from "@/lib/utils/cn";
import { formatMoney, formatRelative } from "@/lib/utils/format";

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

const QUICK_ACTIONS: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> = [
  { href: "/opportunities/new", label: "New Opportunity", hint: "Start from an idea", icon: Sparkles },
  { href: "/explore", label: "Explore Brands", hint: "Find your next collab", icon: Compass },
  { href: "/deals", label: "My Deals", hint: "Track collaborations", icon: Handshake },
  { href: "/messages", label: "Messages", hint: "Continue conversations", icon: MessageCircle },
];

/** The lime-bordered hero from the references, repurposed as the primary
 * creation entry point of the Opportunity Studio. */
function CreateHero() {
  return (
    <Link
      href="/opportunities/new"
      className="group relative mb-6 block overflow-hidden rounded-lg border border-accent-line bg-accent-tint p-5 transition-colors hover:border-accent/60"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(200,255,0,0.22), transparent 65%)" }}
      />
      <Eyebrow tone="accent">Opportunity Studio</Eyebrow>
      <p className="mt-2 max-w-sm font-display text-heading text-fg sm:text-title">
        Turn sketches, references and ideas into an editorial Opportunity.
      </p>
      <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-caption font-bold text-accent-ink transition-colors group-hover:bg-accent-hover">
        <Sparkles className="size-4" aria-hidden /> Create Opportunity
      </span>
    </Link>
  );
}

function ActiveDealCard() {
  const deals = useQuery({
    queryKey: ["deals", "list", { status: "ACTIVE", limit: 1 }],
    queryFn: () => dealsApi.list({ status: "ACTIVE", limit: 1 }),
  });
  const deal = deals.data?.data[0];
  if (!deal) {
    return null;
  }
  const atRisk = deal.health === "AT_RISK" || deal.health === "OVERDUE";
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-accent-line bg-accent-tint/60 p-4 transition-colors hover:border-accent/50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone="accent" dot>
            Active deal
          </Badge>
          {atRisk && <Badge tone="warning">At risk</Badge>}
        </div>
        <p className="mt-2 truncate font-display text-body font-bold text-fg">{deal.title}</p>
      </div>
      {deal.totalValue !== null && (
        <span className="tabular shrink-0 font-display text-kpi text-accent">
          {formatMoney(deal.totalValue, deal.currency)}
        </span>
      )}
    </Link>
  );
}

function QuickActions() {
  return (
    <section className="mb-8" aria-labelledby="quick-actions">
      <SectionHeader title={<span id="quick-actions">Quick Actions</span>} />
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/60"
          >
            <Icon className="size-5 text-accent" aria-hidden />
            <p className="mt-3 text-body font-semibold text-fg">{label}</p>
            <p className="mt-0.5 text-caption text-muted">{hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivity() {
  const notifications = useQuery({
    queryKey: ["notifications", { limit: 6 }],
    queryFn: () => notificationsApi.list({ limit: 6 }),
  });

  return (
    <section aria-labelledby="recent-activity">
      <SectionHeader title={<span id="recent-activity">Activity</span>} />
      {notifications.isLoading ? (
        <SkeletonList count={3} />
      ) : notifications.isError ? (
        <ErrorState title="Couldn't load activity" onRetry={() => notifications.refetch()} />
      ) : notifications.data && notifications.data.data.length > 0 ? (
        <Card className="divide-y divide-border">
          {notifications.data.data.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-4">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.isRead ? "bg-surface-3" : "bg-accent",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-fg">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-caption text-muted">{item.message}</p>
                <p className="mt-1 text-[0.6875rem] text-faint">{formatRelative(item.createdAt)}</p>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="All quiet"
          description="Publishing, collaborators and deals will show up here."
        />
      )}
    </section>
  );
}

export function HomeScreen() {
  const { brand, isLoading: brandLoading, isError: brandError, refetch } = useActiveBrand();
  const brandId = brand?.id;
  const total = useOpportunityCount(brandId);
  const published = useOpportunityCount(brandId, "PUBLISHED");
  const drafts = useOpportunityCount(brandId, "DRAFT");
  const recent = useOpportunities({ brandId, limit: 4 }, Boolean(brandId));

  if (brandError) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load your studio" onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  if (!brandLoading && !brand) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Rocket className="size-5" />}
          title="Set up your brand studio"
          description="Create your brand to start building Opportunities and collaborations."
          action={
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-body font-semibold text-accent-ink hover:bg-accent-hover"
            >
              Get started
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-caption text-muted">{greeting()}</p>
          {brandLoading ? (
            <Skeleton className="mt-1.5 h-7 w-44" />
          ) : (
            <h1 className="mt-0.5 truncate font-display text-title lg:text-[1.875rem]">
              {brand?.name}
            </h1>
          )}
        </div>
        <Link
          href="/activity"
          aria-label="Notifications"
          className="flex size-10 items-center justify-center rounded-md border border-border bg-surface text-fg-2 transition-colors hover:border-border-strong hover:text-fg"
        >
          <Bell className="size-4.5" />
        </Link>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat value={total.data ?? "–"} label="Opportunities" />
            <Stat value={published.data ?? "–"} label="Published" accent />
            <Stat value={drafts.data ?? "–"} label="In draft" />
          </div>

          <CreateHero />
          <ActiveDealCard />

          <section className="mb-8" aria-labelledby="recent-opportunities">
            <SectionHeader
              title={<span id="recent-opportunities">Recent Opportunities</span>}
              action={{ label: "See all", href: "/opportunities" }}
            />
            {recent.isLoading || brandLoading ? (
              <SkeletonList count={2} />
            ) : recent.isError ? (
              <ErrorState title="Couldn't load opportunities" onRetry={() => recent.refetch()} />
            ) : recent.data && recent.data.data.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {recent.data.data.map((opportunity) => (
                  <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Sparkles className="size-5" />}
                title="No Opportunities yet"
                description="Your first editorial Opportunity is one idea away."
                action={
                  <Link
                    href="/opportunities/new"
                    className="inline-flex items-center gap-1.5 text-body font-semibold text-accent hover:text-accent-hover"
                  >
                    Create Opportunity <ArrowRight className="size-4" aria-hidden />
                  </Link>
                }
              />
            )}
          </section>

          <div className="lg:hidden">
            <QuickActions />
          </div>
        </div>

        <aside className="flex flex-col">
          <div className="hidden lg:block">
            <QuickActions />
          </div>
          <RecentActivity />
        </aside>
      </div>
    </PageContainer>
  );
}
