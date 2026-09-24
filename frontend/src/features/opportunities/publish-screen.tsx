"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  Link2,
  Lock,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { useAssets } from "@/features/assets/hooks";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi, type Version } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { useOpportunity } from "./hooks";
import { canPublishWith, evaluateReadiness, type CheckStatus } from "./readiness";

const ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-5 text-accent" aria-hidden />,
  warn: <AlertTriangle className="size-5 text-warning" aria-hidden />,
  fail: <XCircle className="size-5 text-danger" aria-hidden />,
};

function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isConflict && error.details?.currentRevision !== undefined) {
      return "The draft changed after you reviewed it. Review the latest version, then publish.";
    }
    if (error.isConflict) {
      return "This Opportunity is archived or another publish happened at the same time. Refresh and try again.";
    }
    if (error.status === 422) {
      return error.message;
    }
    return error.message;
  }
  return "Publishing failed. Please try again.";
}

function PublishedState({ opportunityId, version }: { opportunityId: string; version: Version }) {
  const base = `/opportunities/${opportunityId}`;
  return (
    <PageContainer size="sm" className="text-center">
      <span className="mx-auto mt-6 flex size-16 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-[0_0_48px_rgba(200,255,0,0.3)]">
        <Check className="size-8" strokeWidth={3} aria-hidden />
      </span>
      <Eyebrow tone="accent" className="mt-8">Published</Eyebrow>
      <h1 className="mt-2 font-display text-title">Version {version.versionNumber} is live</h1>
      <p className="mt-2 text-body text-muted">
        {formatDate(version.publishedAt, true)} · This version is immutable — editing the draft never changes it.
      </p>
      <Card className="mt-8 p-4 text-left">
        <p className="truncate font-display text-body font-bold text-fg">{version.title}</p>
        <p className="mt-1 text-caption text-muted">
          {version.assets.length} asset{version.assets.length === 1 ? "" : "s"} pinned · integrity {version.contentHash.slice(0, 12)}…
        </p>
      </Card>
      <div className="mt-8 flex flex-col gap-3">
        <Button asChild size="lg" fullWidth>
          <Link href={`${base}/share?version=${version.versionNumber}`}>
            <Link2 className="size-4" aria-hidden /> Share privately
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" fullWidth>
          <Link href={`${base}/versions/${version.versionNumber}`}>
            <Eye className="size-4" aria-hidden /> View published version
          </Link>
        </Button>
        <Link href={base} className="mt-2 text-caption font-semibold text-muted hover:text-fg">
          Back to Opportunity
        </Link>
      </div>
    </PageContainer>
  );
}

export function PublishScreen({ opportunityId }: { opportunityId: string }) {
  const client = useQueryClient();
  const [notes, setNotes] = useState("");
  const opportunity = useOpportunity(opportunityId);
  const draft = useQuery({
    queryKey: queryKeys.opportunities.draft(opportunityId),
    queryFn: () => opportunitiesApi.getDraft(opportunityId),
    refetchOnMount: "always",
  });
  const assets = useAssets(opportunityId);

  const publish = useMutation({
    mutationFn: (expectedDraftRevision: number) =>
      opportunitiesApi.publish(opportunityId, {
        notes: notes.trim() || undefined,
        expectedDraftRevision,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.detail(opportunityId) });
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.versions(opportunityId) });
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.draft(opportunityId) });
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });

  // Success is only shown once the backend has confirmed the new version.
  if (publish.isSuccess && publish.data) {
    return <PublishedState opportunityId={opportunityId} version={publish.data} />;
  }

  const failed = opportunity.error ?? draft.error;
  if (failed) {
    return (
      <PageContainer size="sm">
        <ErrorState title="Couldn't prepare publishing" onRetry={() => void draft.refetch()} />
      </PageContainer>
    );
  }
  if (!opportunity.data || !draft.data || assets.isLoading) {
    return <LoadingState label="Checking readiness" className="min-h-dvh" />;
  }

  const data = opportunity.data;
  const allowed = Boolean(data.capabilities?.publish) && !data.archivedAt;
  const checks = evaluateReadiness(data, draft.data, assets.data ?? []);
  const ready = canPublishWith(checks);
  const nextVersion = data.latestVersionNumber + 1;

  return (
    <PageContainer size="sm">
      <Link
        href={`/opportunities/${data.id}/studio`}
        className="mb-4 inline-flex items-center gap-1.5 text-caption font-semibold text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to Studio
      </Link>

      <header className="mb-8">
        <Eyebrow tone="accent">Publish</Eyebrow>
        <h1 className="mt-2 font-display text-title">Ready to publish version {nextVersion}?</h1>
        <p className="mt-2 text-body text-muted">
          Publishing snapshots the saved draft (revision {draft.data.revision}) into an immutable
          version. Later edits never change it.
        </p>
      </header>

      {!allowed && (
        <Card className="mb-6 flex items-center gap-3 border-warning/30 bg-warning-tint p-4">
          <Lock className="size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-body text-fg-2">
            {data.archivedAt
              ? "This Opportunity is archived. Restore it before publishing."
              : "Only brand admins or the Opportunity's creator can publish."}
          </p>
        </Card>
      )}

      <ul className="mb-8 flex flex-col gap-2" aria-label="Readiness checks">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4",
              check.status === "fail" ? "border-danger/30 bg-danger-tint" : "border-border bg-surface",
            )}
          >
            {ICON[check.status]}
            <div>
              <p className="text-body font-semibold text-fg">{check.label}</p>
              <p className="mt-0.5 text-caption text-muted">{check.detail}</p>
            </div>
            <span className="sr-only">
              {check.status === "pass" ? "Passed" : check.status === "warn" ? "Warning" : "Failed"}
            </span>
          </li>
        ))}
      </ul>

      <Field label="Release notes" optional hint="Visible in the version history, not to recipients.">
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            rows={3}
            maxLength={1000}
            value={notes}
            aria-describedby={describedBy}
            placeholder="First look for atelier partners"
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </Field>

      {publish.isError && (
        <p role="alert" className="mt-5 rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
          {publishErrorMessage(publish.error)}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          size="lg"
          className="sm:flex-1"
          disabled={!allowed || !ready}
          loading={publish.isPending}
          onClick={() => publish.mutate(draft.data.revision)}
        >
          <Upload className="size-4" aria-hidden /> Publish version {nextVersion}
        </Button>
        <Button asChild variant="secondary" size="lg" className="sm:flex-1">
          <Link href={`/opportunities/${data.id}/preview`}>
            <Eye className="size-4" aria-hidden /> Preview first
          </Link>
        </Button>
      </div>
      {!ready && allowed && (
        <p className="mt-3 text-center text-caption text-danger">Resolve the failed checks to publish.</p>
      )}
    </PageContainer>
  );
}
