# ADR 0007: Opportunity Creation Studio

## Status

Accepted

## Context

CollabOS is evolving from a brand/creator marketplace into a premium
fashion collaboration SaaS whose core MVP is an **Opportunity Creation
Studio**. A founder turns images, sketches, references and notes into a
polished editorial *Opportunity*, publishes immutable versions of it, and
shares a specific version privately.

The change is evolutionary: no existing module, table, column or row is
removed or rewritten. Existing modules stay mounted.

## Decisions

### Tenant: Brand + BrandMember

`Brand` is the tenant. A new `BrandMember(brandId, userId, role)` with roles
`OWNER | ADMIN | EDITOR | VIEWER` adds a team to what used to be a single
`Brand.ownerId`. `Brand.ownerId` stays the legal owner: it always resolves to
OWNER (even without a member row), can never be demoted or removed, and new
brands get their OWNER row automatically. The migration backfills an OWNER
row for every existing brand. No separate Organization model (deliberately
deferred).

`BrandAccessService` (brands module, exported) is the single source of truth
for a user's role in a brand; suspended brands (`isActive = false`) grant
nothing.

### Domain model

```
Brand ─┬─ BrandMember
       └─ Opportunity ─┬─ OpportunityDraft        (1:1, the only mutable copy)
                       ├─ OpportunityVersion       (immutable snapshots, N)
                       │     └─ OpportunityVersionAsset (pinned assets + alt text)
                       ├─ OpportunityAsset         (uploads, soft-deleted)
                       ├─ OpportunityShareLink     (pinned to one version)
                       ├─ OpportunityMember        (per-opportunity collaborators)
                       ├─ OpportunityAiSuggestion  (AI output, never auto-applied)
                       └─ OpportunityActivity      (audit/activity feed)
```

**Draft as a separate 1:1 table** (not columns on Opportunity, not a
revision log): autosave traffic stays off the Opportunity row, the draft has
its own optimistic-concurrency `revision`, and it can later be replaced by a
CRDT/real-time document without touching versions.

**Structured content is editor-agnostic JSON** stored with `format`
(`tiptap | prosemirror | lexical | slate | blocks`) and `schemaVersion`. The
backend validates generic safety (size ≤ 1 MB, depth, node count, string
length, no prototype-polluting keys, link/source URLs limited to
http(s)/mailto/anchors/`asset:<uuid>`) and never renders HTML. Assets are
referenced as `asset:<uuid>` strings or `assetId` attributes and must belong
to the same opportunity.

### Immutable versions

`POST /opportunities/:id/publish` runs one transaction:

1. `UPDATE opportunities SET latestVersionNumber = latestVersionNumber + 1`
   (with `archivedAt IS NULL`) — the row lock serialises concurrent publishes;
2. load and re-validate the draft under the lock (optional
   `expectedDraftRevision` → 409 if it moved);
3. verify every referenced asset is live and owned by the opportunity;
4. snapshot title/summary/metadata/document + sha256 `contentHash` of the
   canonical JSON;
5. insert `OpportunityVersion` and its `OpportunityVersionAsset` rows;
6. write activity + an `opportunity.published` outbox event.

`@@unique([opportunityId, versionNumber])` is the backstop (P2002 → 409).
Draft saves and asset deletes take the same row lock, so an asset cannot be
deleted between a publish's validation and its pinning.

Immutability is enforced three ways: no update/delete code path; a
PostgreSQL trigger rejecting UPDATE/DELETE on `opportunity_versions` and
`opportunity_version_assets`; and the stored content hash for integrity
checks. Opportunities with versions are never hard-deleted (FKs are
`RESTRICT`); `DELETE /opportunities/:id` archives. Assets used by a published
version are soft-deleted and their stored objects kept.

### Private sharing

`OpportunityShareLink` is pinned to one `OpportunityVersion`. Tokens are 32
random bytes (base64url); only the sha256 is stored and the raw token is
returned once, at creation. `GET /share/:token` (public, throttled,
`Cache-Control: no-store`, `X-Robots-Tag: noindex`) reads only the version
snapshot and returns no internal IDs. Invalid, unknown, revoked, expired,
archived-opportunity and suspended-brand cases all return the same 404.
Access count and last access are tracked. Share tokens and signed-URL
signatures are redacted from request logs, error bodies and OTel spans
(`redactUrl`).

### Permissions

`OpportunityAccessService.authorize(id, user, action)` is called by every
opportunity endpoint. Matrix (`computeCapabilities`, unit-tested):

| Capability | Who |
|---|---|
| view | any brand member, any opportunity collaborator, platform ADMIN (read-only support) |
| edit | brand EDITOR+ or opportunity EDITOR collaborator |
| publish / share / manage | brand ADMIN+, or the creator while they still have edit access |

No view right → 404 (IDs cannot be probed across tenants); view without the
action → 403; archived → read-only (409). Listing is always scoped by
membership (`visibleOpportunitiesWhere`).

### Assets

Uploads reuse the existing `STORAGE_PROVIDER` abstraction (first real
consumer). Files are identified by magic bytes (JPEG/PNG/WEBP/GIF; PDF only
as REFERENCE; never SVG); the declared MIME type must match; image
dimensions are read from headers and capped; size is enforced by Multer while
streaming. Storage keys are opaque (`opportunity-assets/<uuid>.<ext>`) and
never returned; clients get short-lived signed URLs. The local provider
gained a path-traversal guard and a signed-URL serving route
(`GET /storage/*`).

### AI

The existing `AnthropicService` gained `completeStructured` (tool-use with a
forced tool → JSON), validated with zod. Endpoints `generate`, `rewrite`,
`summarize`, `structure`, `titles` store an `OpportunityAiSuggestion` and
**never write to the draft**; the client applies/edits the suggestion and
saves the draft itself. `accept` / `discard` only record the decision.
Without an API key the endpoints return 503 (no template fallback for
generative copy). Throttled to 10/min.

## Migration strategy

`20260923130000_opportunity_studio` is additive only: new enums, tables,
indexes, FKs to existing `users`/`brands`, an idempotent BrandMember
backfill (`ON CONFLICT DO NOTHING`) and the immutability triggers. It was
verified on a disposable PostgreSQL 16 with pre-existing rows (backfill
correct, `prisma migrate diff` reports no drift). Apply with
`prisma migrate deploy` after a backup; no downtime-sensitive locks are
taken on existing tables beyond FK creation on empty new tables.

### Brief → Opportunity (deferred)

`Brief` stays independent and untouched: it is a public marketplace listing
with Applications and Deals hanging off it, whereas an Opportunity is a
private, versioned editorial document. A later phase can add an optional
`Brief.opportunityId` so a published version can be promoted to a public
Brief. No Brief data is migrated or copied.

## Consequences

- New modules/files: `src/opportunities/*`, brand membership in
  `src/brands/*`, `src/storage/storage.controller.ts`,
  `src/common/logging/redact-url.ts`.
- Small additive changes to shared infrastructure: JSON body limit raised to
  2 MB; `AllExceptionsFilter` now passes extra HttpException fields as
  `details` (e.g. `currentRevision` on 409) and redacts URLs;
  `AiModule` exports `AnthropicService`.
- Integration tests (`npm run test:integration`, real PostgreSQL) cover the
  trigger, concurrent publishing and tenant isolation; CI runs them in the
  migration job.

## Deliberately not done

- Real-time collaborative editing (the draft/revision design leaves room).
- Invitations for users without an account (members must already exist).
- Image transcoding/thumbnails and EXIF stripping.
- Migrating the six legacy upload services to `STORAGE_PROVIDER`.
- Linking Briefs to Opportunities.
