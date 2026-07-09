# ADR 0003: Typesense Search Layer via Watermark-Based Incremental Sync

## Status

Accepted

## Context

ADR 0001 deferred search because it "introduces a new stateful external
service with its own indexing lifecycle... no existing scaffolding to build
on." The obvious implementation of "keep the index live" is a Prisma
write-hook: intercept every `create`/`update` on `Product`, `Brand`, `Drop`
and push the change to Typesense synchronously.

That approach was ruled out after investigation: **Prisma 6.19 has removed
`$use()` middleware entirely** (not deprecated — grepping the generated
client's `.d.ts` returns zero matches). The only remaining hook point is
`$extends()`, which would mean restructuring `PrismaService` itself
(`extends PrismaClient`, injected at 300+ call sites across every module in
this codebase). That risk is exactly what "do not rewrite existing modules"
rules out.

## Decision

- **Watermark-based scheduled incremental sync** instead of write hooks.
  `SearchSyncState` (`collection`, `lastSyncedAt`) stores one cursor per
  collection. `ReindexService.reindexIncremental()` queries each of
  Products/Brands/Drops for `updatedAt >= cursor`, upserts changed rows into
  Typesense, then advances the cursor to the timestamp captured *before* the
  query ran (so a row updated mid-sync is picked up on the next pass, not
  skipped).
- A BullMQ repeatable job runs this on `TYPESENSE_REINDEX_INTERVAL_MS`
  (default 5 minutes). `ReindexService.reindexAll()` (full resync from the
  epoch) is exposed as `POST /search/reindex` for manual/admin-triggered
  catch-up.
- **Typesense client is DSN-optional with an honest failure mode**:
  `SearchService.search()` throws `ServiceUnavailableException` if
  `TYPESENSE_HOST` isn't configured, rather than silently returning empty
  results — a caller integrating against this endpoint should be able to
  tell "search isn't set up" apart from "no results matched."
- Three collections (`products`, `brands`, `drops`) with explicit field
  schemas, each keyed on `updatedAt` (int64, sortable) as the
  `default_sorting_field`.

## Consequences

- This is real incremental indexing, but not real-time. Worst case, a
  product edit takes up to one reindex interval to appear in search results.
  That trade-off was accepted explicitly in exchange for not touching
  Products/Brands/Drops' write paths at all — those modules are completely
  unaware search exists.
- If a future turn decides the write-hook approach is worth the risk (e.g.
  once `PrismaService`'s 300+ call sites can be safely refactored, or a
  narrower per-module hook is added deliberately), the watermark sync can be
  kept running in parallel as the reconciliation safety net — it doesn't
  need to be torn out.
