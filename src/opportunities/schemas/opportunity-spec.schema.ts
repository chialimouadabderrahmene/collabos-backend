import { z } from 'zod';

/**
 * R1 — Structured Opportunity Specification.
 *
 * Turns the previously free-form `Opportunity.metadata` into a validated,
 * versioned structure for the founder's instinct and the deal's specificity
 * (see docs/adr/0008-opportunity-spec.md). It lives inside the *same*
 * `Opportunity.metadata` JSON column the app already has — no new table, no
 * migration — under two reserved keys:
 *
 *   metadata.specVersion  — always 1 for this shape (set by the server; the
 *                            client never sends it, see normalizeSpecInMetadata)
 *   metadata.spec          — the structured fields below, all optional
 *
 * Every field is optional: a spec is "structurally valid" the moment it
 * parses, whether it has one field or all eight. This is deliberate —
 * completeness/readiness scoring is a later phase (R2), not this one. This
 * schema only ever rejects a WRONG SHAPE (wrong type, too long, unknown
 * key), never an INCOMPLETE one.
 *
 * Existing unrelated metadata keys (e.g. `collaborationType`, `season`,
 * `presentation`) are untouched by this schema — see
 * OpportunityDocumentService.validateMetadata, which validates `spec` in
 * isolation and merges the result back into the caller's full metadata
 * object.
 */

export const OPPORTUNITY_SPEC_VERSION = 1 as const;

/** Free-text "who is this for" — deliberately not a closed enum. Real
 * collaborator types (ceramicist, production partner, ambassador, ...) are
 * open-ended; forcing a fixed list would misrepresent real opportunities. */
const collaboratorSchema = z
  .object({
    type: z.string().trim().min(1).max(60).optional(),
    notes: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

/**
 * Kept intentionally close to `CreateBriefDto.deliverables` (briefs module)
 * for the same shape of data, without coupling the two modules together.
 */
const deliverablesSchema = z.array(z.string().trim().min(1).max(200)).max(20);

export const opportunitySpecSchema = z
  .object({
    /** Why this opportunity exists — the founder's original reasoning.
     * Never rewritten by AI; see OpportunityAiService "structure". */
    intent: z.string().trim().min(1).max(4000).optional(),
    collaborator: collaboratorSchema.optional(),
    objective: z.string().trim().min(1).max(2000).optional(),
    deliverables: deliverablesSchema.optional(),
    /** Free text on purpose — R1 does not invent or require real dates. */
    timeline: z.string().trim().min(1).max(500).optional(),
    /** Free text on purpose — R1 never forces a currency or numeric shape. */
    budget: z.string().trim().min(1).max(200).optional(),
    constraints: z.string().trim().min(1).max(2000).optional(),
    successCriteria: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type OpportunitySpec = z.infer<typeof opportunitySpecSchema>;

export interface OpportunitySpecIssue {
  path: string;
  message: string;
}

export type SpecValidationResult =
  | { ok: true; spec: OpportunitySpec }
  | { ok: false; issues: OpportunitySpecIssue[] };

/** Validates `metadata.spec` in isolation (does not know or care about any
 * other key in `metadata`). Absence of `spec` is not validated here — the
 * caller decides what "no spec present" means (see
 * OpportunityDocumentService). */
export function validateOpportunitySpec(value: unknown): SpecValidationResult {
  const result = opportunitySpecSchema.safeParse(value);
  if (result.success) {
    return { ok: true, spec: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  };
}
