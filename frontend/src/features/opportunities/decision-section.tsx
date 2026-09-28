"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow, SectionHeader } from "@/components/ui/display";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { ConfirmationDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { isEmptyOpportunitySpec, readOpportunitySpec } from "@/features/editor/document-model";
import { brandsApi } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import {
  opportunitiesApi,
  type Decision,
  type DecisionStatus,
  type VersionSummary,
} from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/utils/format";
import { evaluateSpecConfidence } from "./readiness";

/** Maps user ids to display names via the brand team (when visible). Mirrors
 * the identical local helper in versions-screen.tsx — small enough, and
 * screen-local enough, that this codebase duplicates it rather than sharing
 * it; kept consistent with that existing choice. */
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

const STATUS_LABEL: Record<DecisionStatus, string> = { GO: "GO", HOLD: "HOLD", NO_GO: "NO GO" };
const STATUS_TONE: Record<DecisionStatus, "success" | "warning" | "danger"> = {
  GO: "success",
  HOLD: "warning",
  NO_GO: "danger",
};

function DecisionHistoryRow({ decision, nameOf }: { decision: Decision; nameOf: (id: string) => string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={STATUS_TONE[decision.status]}>{STATUS_LABEL[decision.status]}</Badge>
        <span className="text-caption text-faint">Version {decision.versionNumber}</span>
      </div>
      <p className="mt-2 text-body text-fg-2">{decision.rationale}</p>
      <p className="mt-2 text-caption text-faint">
        {nameOf(decision.decidedById)} · {formatDate(decision.decidedAt, true)}
      </p>
    </Card>
  );
}

/**
 * R3 — the user records GO/HOLD/NO_GO against a specific published version.
 * This is never computed from Confidence (R2) or anything else: Confidence
 * is shown only as context, never as a suggestion or a default selection.
 * No score, no percentage, no "recommended" label anywhere here.
 */
export function DecisionSection({
  opportunityId,
  brandId,
  metadata,
  latestVersion,
  canDecide,
}: {
  opportunityId: string;
  brandId: string | undefined;
  metadata: Record<string, unknown>;
  latestVersion: VersionSummary | undefined;
  canDecide: boolean;
}) {
  const client = useQueryClient();
  const nameOf = usePeopleNames(brandId);
  const [status, setStatus] = useState<DecisionStatus | null>(null);
  const [rationale, setRationale] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const decisions = useQuery({
    queryKey: queryKeys.opportunities.decisions(opportunityId),
    queryFn: () => opportunitiesApi.decisions.list(opportunityId),
    enabled: canDecide,
  });

  const create = useMutation({
    mutationFn: (input: { versionNumber: number; status: DecisionStatus; rationale: string }) =>
      opportunitiesApi.decisions.create(opportunityId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.decisions(opportunityId) });
    },
  });

  if (!canDecide) {
    return null;
  }

  const spec = readOpportunitySpec(metadata);
  const confidence = isEmptyOpportunitySpec(spec) ? null : evaluateSpecConfidence(spec);

  const record = () => {
    if (!status || !latestVersion) {
      return;
    }
    create.mutate(
      { versionNumber: latestVersion.versionNumber, status, rationale: rationale.trim() },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setStatus(null);
          setRationale("");
          toast.success(`Decision recorded: ${STATUS_LABEL[status]}`);
        },
        onError: (error) => {
          setConfirmOpen(false);
          toast.error("Couldn't record the decision", error instanceof ApiError ? error.message : undefined);
        },
      },
    );
  };

  const canSubmit = Boolean(status) && rationale.trim().length > 0 && Boolean(latestVersion);

  return (
    <section aria-labelledby="decision">
      <SectionHeader title={<span id="decision">Decision</span>} />

      {!latestVersion ? (
        <Card className="p-5 text-body text-muted">
          A published version is required before a decision can be recorded. Publish this Opportunity first.
        </Card>
      ) : (
        <Card className="p-5">
          <Eyebrow tone="accent">Deciding on</Eyebrow>
          <p className="mt-1 font-display text-heading text-fg">Version {latestVersion.versionNumber}</p>
          <p className="text-caption text-muted">Published {formatDate(latestVersion.publishedAt, true)}</p>

          {confidence && (
            <p className="mt-3 text-caption text-faint">
              Confidence check —{" "}
              {confidence.complete
                ? "every specification field is filled in."
                : `${confidence.missing.length} detail${confidence.missing.length === 1 ? "" : "s"} still missing.`}
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            {(["GO", "HOLD", "NO_GO"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                onClick={() => setStatus(option)}
                className={`h-11 rounded-md border text-label font-semibold uppercase transition-colors ${
                  status === option
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-border bg-surface text-muted hover:text-fg"
                }`}
              >
                {STATUS_LABEL[option]}
              </button>
            ))}
          </div>

          <Field label="Rationale" className="mt-4">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                rows={3}
                value={rationale}
                aria-describedby={describedBy}
                placeholder="Why this decision, in your own words — never generated for you."
                onChange={(event) => setRationale(event.target.value)}
              />
            )}
          </Field>

          <Button className="mt-4" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
            Record decision
          </Button>
        </Card>
      )}

      <div className="mt-5">
        {decisions.isError ? (
          <ErrorState title="Couldn't load decision history" onRetry={() => void decisions.refetch()} />
        ) : decisions.isLoading ? (
          <LoadingState label="Loading decision history" />
        ) : decisions.data && decisions.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {decisions.data.map((decision) => (
              <DecisionHistoryRow key={decision.id} decision={decision} nameOf={nameOf} />
            ))}
          </div>
        ) : (
          <p className="text-caption text-faint">No decisions recorded yet.</p>
        )}
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={status ? `Record ${STATUS_LABEL[status]} for Version ${latestVersion?.versionNumber}?` : "Record decision?"}
        description={rationale.trim() || undefined}
        confirmLabel={status ? STATUS_LABEL[status] : "Confirm"}
        loading={create.isPending}
        onConfirm={record}
      />
    </section>
  );
}
