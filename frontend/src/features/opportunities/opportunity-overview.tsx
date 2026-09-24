"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Eye, History, Link2, PenTool, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OpportunityStatusBadge } from "@/components/domain/opportunity-card";
import { BackLink, Breadcrumbs, PageContainer } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow, KeyValue, SectionHeader } from "@/components/ui/display";
import { ErrorState, Skeleton, SkeletonList } from "@/components/ui/feedback";
import { ConfirmationDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatRelative } from "@/lib/utils/format";
import { ActivityFeed } from "./activity-feed";
import { Collaborators } from "./collaborators";
import { useArchiveOpportunity, useOpportunity } from "./hooks";

export function OpportunityOverview({ opportunityId }: { opportunityId: string }) {
  const opportunity = useOpportunity(opportunityId);
  const archive = useArchiveOpportunity(opportunityId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const versions = useQuery({
    queryKey: queryKeys.opportunities.versions(opportunityId),
    queryFn: () => opportunitiesApi.versions(opportunityId),
    enabled: opportunity.isSuccess,
  });
  const links = useQuery({
    queryKey: queryKeys.opportunities.shareLinks(opportunityId),
    queryFn: () => opportunitiesApi.shareLinks.list(opportunityId),
    enabled: Boolean(opportunity.data?.capabilities?.share),
  });

  if (opportunity.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="mb-3 h-5 w-24" />
        <Skeleton className="mb-2 h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <SkeletonList className="mt-8" count={3} />
      </PageContainer>
    );
  }

  if (opportunity.isError || !opportunity.data) {
    const notFound = opportunity.error instanceof ApiError && opportunity.error.isNotFound;
    return (
      <PageContainer>
        <BackLink href="/opportunities" />
        <ErrorState
          title={notFound ? "Opportunity not found" : "Couldn't load this Opportunity"}
          description={notFound ? "It doesn't exist or you don't have access to it." : undefined}
          onRetry={notFound ? undefined : () => opportunity.refetch()}
        />
      </PageContainer>
    );
  }

  const data = opportunity.data;
  const can = data.capabilities ?? { view: true, edit: false, publish: false, share: false, manage: false };
  const archived = Boolean(data.archivedAt);
  const latest = versions.data?.[0];
  const activeLinks = links.data?.filter((link) => link.status === "ACTIVE").length ?? 0;
  const base = `/opportunities/${data.id}`;

  const restore = async () => {
    setRestoring(true);
    try {
      await opportunitiesApi.restore(data.id);
      await opportunity.refetch();
      toast.success("Opportunity restored");
    } catch (error) {
      toast.error("Couldn't restore", error instanceof ApiError ? error.message : undefined);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <PageContainer size="lg">
      <Breadcrumbs items={[{ label: "Opportunities", href: "/opportunities" }, { label: data.title }]} />
      <div className="lg:hidden">
        <BackLink href="/opportunities" />
      </div>

      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <OpportunityStatusBadge status={data.status} />
          {data.latestVersionNumber > 0 && (
            <span className="text-caption text-muted">v{data.latestVersionNumber} published</span>
          )}
        </div>
        <h1 className="font-display text-title [text-wrap:balance] lg:text-[2.25rem] lg:leading-tight">{data.title}</h1>
        {data.summary && <p className="mt-2 max-w-2xl text-body text-muted">{data.summary}</p>}
        <p className="mt-3 text-caption text-faint">Edited {formatRelative(data.updatedAt)}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {can.edit && !archived && (
            <Button asChild>
              <Link href={`${base}/studio`}>
                <PenTool className="size-4" aria-hidden /> Open Studio
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href={`${base}/preview`}>
              <Eye className="size-4" aria-hidden /> Preview draft
            </Link>
          </Button>
          {can.publish && !archived && (
            <Button asChild variant="secondary">
              <Link href={`${base}/publish`}>
                <Upload className="size-4" aria-hidden /> Publish
              </Link>
            </Button>
          )}
          {can.share && data.latestVersionNumber > 0 && !archived && (
            <Button asChild variant="secondary">
              <Link href={`${base}/share`}>
                <Link2 className="size-4" aria-hidden /> Share
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href={`${base}/versions`}>
              <History className="size-4" aria-hidden /> Versions
            </Link>
          </Button>
        </div>
      </header>

      {archived && (
        <Card className="mb-8 flex flex-col gap-3 border-warning/30 bg-warning-tint p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-fg-2">
            Archived {formatDate(data.archivedAt as string)}. Share links are paused; published versions are kept.
          </p>
          {can.manage && (
            <Button variant="secondary" size="sm" loading={restoring} onClick={restore}>
              <ArchiveRestore className="size-4" aria-hidden /> Restore
            </Button>
          )}
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="published">
            <SectionHeader
              title={<span id="published">Latest publication</span>}
              action={latest ? { label: "All versions", href: `${base}/versions` } : undefined}
            />
            {versions.isLoading ? (
              <Skeleton className="h-28 w-full rounded-lg" />
            ) : latest ? (
              <Link
                href={`${base}/versions/${latest.versionNumber}`}
                className="block rounded-lg border border-accent-line bg-accent-tint/50 p-5 transition-colors hover:border-accent/50"
              >
                <Eyebrow tone="accent">Version {latest.versionNumber}</Eyebrow>
                <p className="mt-2 font-display text-heading text-fg">{latest.title}</p>
                <p className="mt-1 text-caption text-muted">
                  Published {formatDate(latest.publishedAt, true)}
                  {latest.notes ? ` · “${latest.notes}”` : ""}
                </p>
              </Link>
            ) : (
              <Card className="p-5 text-body text-muted">
                Not published yet. Publishing creates an immutable version you can share privately.
              </Card>
            )}
          </section>

          <section aria-labelledby="activity">
            <SectionHeader title={<span id="activity">Activity</span>} />
            <ActivityFeed opportunityId={data.id} />
          </section>
        </div>

        <aside className="flex flex-col gap-10">
          <section aria-labelledby="details">
            <SectionHeader title={<span id="details">Details</span>} />
            <Card className="px-4">
              <KeyValue label="Status" value={data.status.toLowerCase()} />
              <KeyValue label="Versions" value={data.latestVersionNumber} />
              {can.share && <KeyValue label="Active share links" value={activeLinks} />}
              {typeof data.metadata.collaborationType === "string" && (
                <KeyValue label="Type" value={data.metadata.collaborationType} />
              )}
              {typeof data.metadata.season === "string" && <KeyValue label="Season" value={data.metadata.season} />}
              <KeyValue label="Created" value={formatDate(data.createdAt)} />
            </Card>
          </section>

          <section aria-labelledby="collaborators">
            <SectionHeader title={<span id="collaborators">Collaborators</span>} />
            <Collaborators opportunityId={data.id} canManage={can.manage && !archived} />
          </section>

          {can.manage && !archived && (
            <section aria-labelledby="danger">
              <SectionHeader title={<span id="danger">Archive</span>} />
              <p className="mb-3 text-caption text-muted">
                Archiving pauses every share link. Published versions stay intact and you can restore later.
              </p>
              <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)}>
                <Archive className="size-4" aria-hidden /> Archive Opportunity
              </Button>
            </section>
          )}
        </aside>
      </div>

      <ConfirmationDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this Opportunity?"
        description="All share links stop working until you restore it."
        confirmLabel="Archive"
        tone="danger"
        loading={archive.isPending}
        onConfirm={() =>
          archive.mutate(undefined, {
            onSuccess: () => {
              setConfirmArchive(false);
              toast.success("Opportunity archived");
            },
            onError: (error) =>
              toast.error("Couldn't archive", error instanceof ApiError ? error.message : undefined),
          })
        }
      />
    </PageContainer>
  );
}
