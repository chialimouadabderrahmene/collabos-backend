import { countNodes, plainText, readOpportunitySpec, type OpportunitySpec } from "@/features/editor/document-model";
import type { Version } from "@/lib/api/opportunities";

/**
 * R6 — VERSION HISTORY → "what changed?". Deliberately not a generic diff
 * engine: compares the eight R1 spec fields field-by-field (human-readable,
 * matching the labels already used on the Overview page's read-only
 * Specification card) plus a lightweight structural summary of the
 * document (word/heading counts, reusing the same `plainText`/`countNodes`
 * helpers `readiness.ts` already uses on draft content) — never a real
 * text diff, never image bytes. No score, no recommendation: just what
 * changed, in each direction.
 */

type SpecFieldKey = keyof OpportunitySpec;

const SPEC_FIELD_LABELS: Record<SpecFieldKey, string> = {
  intent: "Why this exists",
  collaborator: "Looking for",
  objective: "Objective",
  deliverables: "Deliverables",
  timeline: "Timing",
  budget: "Budget",
  constraints: "Constraints",
  successCriteria: "Success looks like",
};

const SPEC_FIELD_ORDER: SpecFieldKey[] = [
  "intent",
  "collaborator",
  "objective",
  "deliverables",
  "timeline",
  "budget",
  "constraints",
  "successCriteria",
];

export type ChangeStatus = "added" | "removed" | "changed";

export interface SpecFieldChange {
  key: SpecFieldKey;
  label: string;
  status: ChangeStatus;
  from: string | null;
  to: string | null;
}

export interface ContentChange {
  status: ChangeStatus;
  from: string;
  to: string;
}

export interface VersionComparison {
  specChanges: SpecFieldChange[];
  contentChange: ContentChange | null;
  hasChanges: boolean;
}

function displayValue(spec: OpportunitySpec, key: SpecFieldKey): string | null {
  switch (key) {
    case "collaborator": {
      const parts = [spec.collaborator?.type, spec.collaborator?.notes].filter(
        (part): part is string => Boolean(part && part.trim()),
      );
      return parts.length > 0 ? parts.join(" — ") : null;
    }
    case "deliverables": {
      const items = (spec.deliverables ?? []).filter((item) => item.trim());
      return items.length > 0 ? items.join(", ") : null;
    }
    default: {
      const value = spec[key] as string | undefined;
      return value && value.trim() ? value : null;
    }
  }
}

function fieldChange(spec_a: OpportunitySpec, spec_b: OpportunitySpec, key: SpecFieldKey): SpecFieldChange | null {
  const from = displayValue(spec_a, key);
  const to = displayValue(spec_b, key);
  if (from === to) {
    return null;
  }
  const status: ChangeStatus = from === null ? "added" : to === null ? "removed" : "changed";
  return { key, label: SPEC_FIELD_LABELS[key], status, from, to };
}

function contentSummary(content: unknown): string {
  const words = plainText(content).split(/\s+/).filter(Boolean).length;
  const headings = countNodes(content, "heading");
  return `${words} word${words === 1 ? "" : "s"}, ${headings} heading${headings === 1 ? "" : "s"}`;
}

/** Compares two published versions of the *same* Opportunity. The caller
 * is responsible for that scoping — this function only looks at the two
 * snapshots handed to it. */
export function compareVersions(a: Version, b: Version): VersionComparison {
  const specA = readOpportunitySpec(a.metadata);
  const specB = readOpportunitySpec(b.metadata);

  const specChanges = SPEC_FIELD_ORDER.map((key) => fieldChange(specA, specB, key)).filter(
    (change): change is SpecFieldChange => change !== null,
  );

  const fromSummary = contentSummary(a.content);
  const toSummary = contentSummary(b.content);
  const contentChange: ContentChange | null =
    fromSummary === toSummary ? null : { status: "changed", from: fromSummary, to: toSummary };

  return {
    specChanges,
    contentChange,
    hasChanges: specChanges.length > 0 || contentChange !== null,
  };
}
