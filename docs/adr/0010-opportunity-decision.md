# ADR 0010: Decision (R3)

## Status

Accepted

## Context

R1 (`docs/adr/0008-opportunity-spec.md`) gave Opportunities a structured
Specification. R2 (frontend-only, no ADR of its own) added a deterministic
Confidence check — a pure function reporting which Specification fields are
still missing, with no scoring and no automatic judgment.

The product graph's last step for this phase is Decision:

```
SPECIFICITY → CONFIDENCE → DECISION
```

R3 lets a user explicitly record **GO / HOLD / NO_GO** against an
Opportunity. This is not computed from Confidence, not AI-generated, and
never automatic — Confidence is contextual information shown next to the
decision UI, nothing more.

## Decision

### Additive table, not a metadata key

Unlike R1's spec (which reused the existing `Opportunity.metadata` JSON),
a Decision is its own row: it needs its own immutable audit fields
(`decidedById`, `decidedAt`) and a real foreign key to the exact
`OpportunityVersion` it was made about — a JSON blob inside `metadata`
can't express "this row must reference a real, already-published version
of this same opportunity" as a database constraint the way a normal FK
relation can.

```prisma
enum OpportunityDecisionStatus { GO HOLD NO_GO }

model OpportunityDecision {
  id            String                    @id @default(uuid())
  opportunityId String
  opportunity   Opportunity               @relation(...)
  versionId     String
  version       OpportunityVersion        @relation(...)
  status        OpportunityDecisionStatus
  rationale     String
  decidedById   String
  decidedBy     User                      @relation("OpportunityDecisionDecider", ...)
  decidedAt     DateTime                  @default(now())
  createdAt     DateTime                  @default(now())
}
```

Migration `20260928094854_opportunity_decisions` is purely additive: one new
enum, one `ALTER TYPE ... ADD VALUE` on the existing
`OpportunityActivityType` enum (appending `DECISION_RECORDED` — safe,
non-destructive), one new table, two indexes, three FKs. No existing table
is altered or dropped; no existing row is touched.

### Version binding — reusing the share-link pattern exactly

`OpportunityShareLinksService.create` already had to solve "pin this record
to one specific published version of this specific opportunity, and reject
anything else" (`docs/adr/0007-opportunity-creation-studio.md`). R3 reuses
the identical mechanism: the lookup is the compound-unique key
`opportunityVersion.findUnique({ where: { opportunityId_versionNumber: {
opportunityId, versionNumber } } })`.

This single query is what makes three of the required rejections free,
with no extra code:
- a `versionNumber` that was never published → no row → 404;
- a `versionNumber` that only exists as a draft → drafts live in a
  different table (`opportunity_drafts`) entirely, never in
  `opportunity_versions`, so they can never match this query;
- a `versionNumber` that belongs to a *different* opportunity → the
  compound key requires both fields to match together, so "version 1 of
  opportunity B" cannot satisfy a lookup scoped to opportunity A.

### Authorization — no new permission tier

`OpportunityDecisionsService` calls the existing
`OpportunityAccessService.authorize(opportunityId, user,
OpportunityAction.MANAGE)` for both `create` and `list` — the same action
already used by archive/restore, and the same capability tier `publish`
and `share` already resolve to (brand ADMIN+, or the creator while they
still hold edit access). No sixth `OpportunityAction`, no new role, no
change to `computeCapabilities`.

### Immutability

There is no update or delete method anywhere in
`OpportunityDecisionsService`, and no route exposes one. A changed decision
is a new row (a later `decidedAt`), never an edit to an earlier one —
mirroring how `OpportunityVersion` rows are never updated either. Unlike
versions, there is no database trigger enforcing this (versions needed one
because their immutability is a hard product guarantee that must survive
even a bug in application code publishing a second time to the same row;
Decision has no equivalent risk — there's no operation that would ever
target an existing decision row by ID). This is intentionally the minimal
guarantee the product actually needs, not a copy of the version trigger for
its own sake.

### Rationale validation

Matches the codebase's established pattern (`opportunities.service.ts`,
`opportunity-share-links.service.ts`): the DTO does type/length validation
(`@IsString() @MinLength(1) @MaxLength(1000)`, same bound as
`PublishOpportunityDto.notes`); the service trims and rejects
whitespace-only content with the same `BadRequestException` shape used
elsewhere, rather than introducing a `class-transformer` `@Transform`
pattern that doesn't otherwise exist in this codebase.

### Activity

`OpportunityActivityType.DECISION_RECORDED` is written inside the same
transaction as the decision row, via the existing
`OpportunityActivityService` — the same pattern `SHARE_LINK_CREATED` and
`PUBLISHED` already use. No new event/outbox architecture; this is not
published to the outbox (unlike `PUBLISHED`), since nothing downstream
currently needs to react to a decision — that can be added later without
touching this ADR's decisions if a real consumer appears.

## API

```
POST /opportunities/:id/decisions   -> DecisionResponse (201)
GET  /opportunities/:id/decisions   -> DecisionResponse[] (200, newest first)
```

No `PATCH`/`DELETE` — deliberately, per "immutable history" above.

## Consequences

- New files only: `opportunity-decisions.controller.ts`,
  `services/opportunity-decisions.service.ts` (+ its spec), one DTO
  (`CreateDecisionDto` in the existing `dto/publishing.dto.ts`), one
  response type + mapper function in the existing
  `types/opportunity-response.types.ts` / `mappers/opportunity.mapper.ts`.
- `Opportunity`, `OpportunityVersion` and `User` each gain one additive
  relation array field.
- Nothing about Specification (R1), Confidence (R2, frontend-only),
  publishing, drafts, assets, AI, or any other module changes.

## Deferred (explicitly out of scope for R3)

Any automatic transformation from Confidence to a decision, AI-authored or
AI-influenced rationale, decision editing/deletion, decision-triggered
downstream automation (Brief/Deal handoff), and version comparison. All
future work, not designed here.
