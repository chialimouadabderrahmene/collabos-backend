"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Eye, History, Link2, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Publication, resolverFrom } from "@/components/editorial/publication";
import { BackLink, Breadcrumbs, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, SkeletonList } from "@/components/ui/feedback";
import { useSession } from "@/features/auth/hooks";
import { readPresentation } from "@/features/editor/document-model";
import { brandsApi } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/utils/format";
import { useOpportunity } from "./hooks";
import { DeviceFrame, DeviceSwitch, type Device } from "./preview-screen";

/** Maps user ids to display names via the brand team (when visible). */
function usePeopleNames(brandId: string | undefined) {
  const session = useSession();
  const members = useQuery({
    queryKey: brandId ? queryKeys.brands.members(brandId) : ["brands", "none", "members"],
    queryFn: () => brandsApi.members.list(brandId as string),
    enabled: Boolean(brandId),
    retry: false,
  });
  return (userId: string): string => {
    if (session.data?.id === userId) {
      return "You";
    }
    const member = members.data?.find((item) => item.userId === userId);
    return member ? (member.displayName ?? member.email) : "A team member";
  };
}

export function VersionsScreen({ opportunityId }: { opportunityId: string }) {
  const opportunity = useOpportunity(opportunityId);
  const nameOf = usePeopleNames(opportunity.data?.brandId);
  const versions = useQuery({
    queryKey: queryKeys.opportunities.versions(opportunityId),
    queryFn: () => opportunitiesApi.versions(opportunityId),
  });
  const base = `/opportunities/${opportunityId}`;
  const canShare = Boolean(opportunity.data?.capabilities?.share) && !opportunity.data?.archivedAt;

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Opportunities", href: "/opportunities" },
          { label: opportunity.data?.title ?? "Opportunity", href: base },
          { label: "Versions" },
        ]}
      />
      <div className="lg:hidden">
        <BackLink href={base} />
      </div>
      <PageHeader
        title="Versions"
        subtitle="Every publication is an immutable snapshot. Editing the draft never changes them."
      />

      {versions.isLoading ? (
        <SkeletonList count={3} />
      ) : versions.isError ? (
        <ErrorState title="Couldn't load versions" onRetry={() => versions.refetch()} />
      ) : versions.data && versions.data.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {versions.data.map((version, index) => (
            <li key={version.versionNumber}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-tint font-display text-heading font-bold text-accent">
                  v{version.versionNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-body font-bold text-fg">{version.title}</p>
                    {index === 0 && <Badge tone="accent" dot>Latest</Badge>}
                    <Badge tone="neutral">
                      <Lock className="size-2.5" aria-hidden /> Immutable
                    </Badge>
                  </div>
                  <p className="mt-1 text-caption text-muted">
                    {formatDate(version.publishedAt, true)} · by {nameOf(version.publishedById)}
                  </p>
                  {version.notes && <p className="mt-1 text-caption text-fg-2">“{version.notes}”</p>}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${base}/versions/${version.versionNumber}`}>
                      <Eye className="size-4" aria-hidden /> View
                    </Link>
                  </Button>
                  {canShare && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`${base}/share?version=${version.versionNumber}`}>
                        <Link2 className="size-4" aria-hidden /> Share
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<History className="size-5" />}
          title="Nothing published yet"
          description="Publish from the Studio to create version 1."
          action={
            opportunity.data?.capabilities?.edit ? (
              <Button asChild>
                <Link href={`${base}/studio`}>Open Studio</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </PageContainer>
  );
}

/** A single immutable published version, rendered as the publication. */
export function VersionScreen({ opportunityId, versionNumber }: { opportunityId: string; versionNumber: number }) {
  const [device, setDevice] = useState<Device>("desktop");
  const version = useQuery({
    queryKey: queryKeys.opportunities.version(opportunityId, versionNumber),
    queryFn: () => opportunitiesApi.version(opportunityId, versionNumber),
    // Refresh before the version's signed asset URLs expire.
    refetchInterval: 10 * 60_000,
  });
  const opportunity = useOpportunity(opportunityId);
  const base = `/opportunities/${opportunityId}`;

  if (version.isError) {
    const notFound = version.error instanceof ApiError && version.error.isNotFound;
    return (
      <div className="mx-auto max-w-md px-6 pt-24">
        <ErrorState title={notFound ? "Version not found" : "Couldn't load this version"} onRetry={notFound ? undefined : () => version.refetch()} />
      </div>
    );
  }
  if (!version.data) {
    return <LoadingState label="Loading version" className="min-h-dvh" />;
  }

  const data = version.data;
  const canShare = Boolean(opportunity.data?.capabilities?.share) && !opportunity.data?.archivedAt;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-3 backdrop-blur sm:px-4">
        <Link href={`${base}/versions`} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-caption font-semibold text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Versions</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Badge tone="accent">Version {data.versionNumber}</Badge>
          <Badge tone="neutral">
            <Lock className="size-2.5" aria-hidden /> Read only
          </Badge>
        </div>
        <DeviceSwitch value={device} onChange={setDevice} />
        {canShare && (
          <Button asChild size="sm">
            <Link href={`${base}/share?version=${data.versionNumber}`}>
              <Link2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Share</span>
            </Link>
          </Button>
        )}
      </header>
      <DeviceFrame device={device}>
        <Publication
          className="py-12"
          title={data.title}
          summary={data.summary}
          content={data.content}
          presentation={readPresentation(data.metadata)}
          resolveAsset={resolverFrom(data.assets)}
          meta={`Version ${data.versionNumber} · Published ${formatDate(data.publishedAt)}`}
          notice={
            <p className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-caption text-muted">
              <Lock className="size-3.5" aria-hidden /> Published snapshot — immutable. Integrity{" "}
              <code className="font-mono text-fg-2">{data.contentHash.slice(0, 12)}</code>
              <Link href={base} className="ml-auto inline-flex items-center gap-1 font-semibold text-accent">
                Overview <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </p>
          }
        />
      </DeviceFrame>
    </div>
  );
}
