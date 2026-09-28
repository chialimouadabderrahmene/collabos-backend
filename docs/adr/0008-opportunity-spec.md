# ADR 0008: Structured Opportunity Specification (R1)

## Status

Accepted

## Context

A read-only product/architecture audit of Opportunity Studio (see
`docs/ui-implementation-status.md` history and the audit conducted before
this change) found the Studio to be a strong, well-engineered **editorial
publishing** tool, but not yet a **decision-making** system. The intended
product sequence is:

```
INSTINCT → UNDERSTANDING → SPECIFICITY → SUBSTANCE → VISUALISATION → CONFIDENCE → DECISION
```

Opportunity Studio today covers Substance (assets), Visualisation (canvas,
preview, published version) and the mechanics around Decision (publish,
share) well. It does nothing for Instinct or Specificity: `Opportunity.metadata`
is unvalidated `Record<string, unknown>`, and the founder's original
reasoning for creating an opportunity (the "founder notes" already collected
in the New Opportunity form) is currently sent only to the AI "structure"
endpoint as a one-off prompt input — never persisted, gone the moment the
request completes.

This ADR covers **R1 only**: giving Instinct and Specificity a real,
validated data foundation. R2 (Confidence scoring), R3 (Decision records)
and everything downstream are explicitly out of scope and are not designed
here.

## Decision

### No new table, no migration

The specification lives inside the existing `Opportunity.metadata` JSON
column, under two reserved keys:

```jsonc
{
  // ...whatever else metadata already held (collaborationType, season,
  // presentation, ...) — untouched by this change.
  "specVersion": 1,
  "spec": {
    "intent": "string, optional",
    "collaborator": { "type": "string, optional", "notes": "string, optional" },
    "objective": "string, optional",
    "deliverables": ["string, ...] optional, max 20"],
    "timeline": "string, optional",
    "budget": "string, optional",
    "constraints": "string, optional",
    "successCriteria": "string, optional"
  }
}
```

Every field in `spec` is optional. This is a **structural** validation
boundary, not a **readiness** one (see "Structural vs. readiness
validation" below) — a spec with a single field, or no fields at all, is
valid. Completeness/confidence scoring belongs to R2.

`specVersion` is always set by the server, never required from the client:
if the client omits it, it defaults to `1`; if the client sends a value
other than `1`, the request is rejected (`400`) rather than silently
coerced, so a future `specVersion: 2` migration has a real signal to work
from. `timeline` and `budget` are deliberately free text — R1 never invents
a date or forces a currency, per the product requirement that this phase is
additive, not authoritative.

### Where validation lives

`OpportunityDocumentService` already validated `Opportunity.metadata` (a
generic JSON-tree safety check — size/depth/no prototype pollution, no
asset references) for `create` and `update`, shared by both entry points.
R1 adds one more step inside the same `validateMetadata()` method: if the
caller's metadata includes a `spec` key, it is parsed with a new zod schema
(`opportunities/schemas/opportunity-spec.schema.ts`) and, on success,
written back with `specVersion` normalized. Metadata without a `spec` key —
every opportunity created before this change, and any update that doesn't
touch `spec` — passes through completely unchanged.

`OpportunityPublishService` snapshots `Opportunity.metadata` wholesale into
each `OpportunityVersion.metadata` already (unchanged code path) — so a
spec is included in every published version for free. One line was added
immediately before that snapshot, `documents.assertPublishableMetadata(...)`,
which re-runs the same structural check as a defence-in-depth boundary:
the data was already validated when it was written, so this should never
fire, but publish is the point after which the spec becomes permanently
immutable, so it gets its own explicit gate rather than trusting history.

No second validation architecture, no second autosave path: `zod` is
already used elsewhere in this codebase (`opportunities/ai/*`) for
structured AI output, and this reuses the same library and error-shape
convention (`BadRequestException({ message, issues })`) the rest of the
opportunities module already uses for `class-validator` DTO failures.

### Structural vs. readiness validation

This is the one distinction the whole ADR turns on:

- **Structural validation (R1, this change)**: is the *shape* right? Wrong
  field type, unknown key, or a value over its length limit is rejected.
  An empty or partial spec is accepted.
- **Readiness/confidence validation (R2, not built)**: is the *content*
  good enough to act on? "No collaborator specified for a sourcing
  opportunity", "no success criteria" — advisory scoring, not a hard
  rejection. Nothing in this change computes, stores, or exposes a
  readiness score.

### Founder intent

The New Opportunity form's "Founder notes" field already existed and was
already sent to `POST /opportunities/:id/ai/structure` as one-shot AI
input. R1 changes nothing about that AI call; it additionally persists the
same text into `metadata.spec.intent` via the *existing* `CreateOpportunityDto.metadata`
field — no new DTO field, no new endpoint. AI "structure" (and every other
AI operation) continues to only ever write an `OpportunityAiSuggestion` row;
none of them write to `Opportunity.metadata`, so the founder's original
intent cannot be silently rewritten by an AI operation, before or after
this change.

### Frontend

The New Opportunity form's existing "notes" field now also populates
`metadata.spec.intent` on create. The Studio's existing Properties panel
gains one additional, always-visible section ("Specification") alongside
its existing Block and Publication sections, using the same input
components and the same save mechanism the panel's Publication settings
already use (`PATCH /opportunities/:id` via `useUpdateOpportunity`, merging
into the existing `metadata` object exactly as `presentation` already does)
— not the document draft/autosave endpoint, since the spec is
Opportunity-level data, not document content, and `PATCH /opportunities/:id`
has no revision/optimistic-locking concept to preserve or duplicate.

## Consequences

- Additive only: no migration, no new table, no removed functionality.
- `metadata.spec` and `metadata.specVersion` are new *conventions* inside an
  already-free-form column, not a schema change at the database level —
  fully backward compatible with every existing row.
- Every existing AI, asset, publish, share and permission code path is
  unchanged; they already treated `metadata` as an opaque JSON blob and
  continue to.

## Deferred (explicitly out of scope for R1)

Readiness/confidence scoring, missing-information detection,
`OpportunityDecision` (GO/HOLD/NO_GO), AI-generated specifications, version
comparison, and any change to how Briefs/Deals relate to Opportunities —
all R2/R3 and later, not designed or scaffolded by this change.
