# ADR 0004: Storage Provider Abstraction (S3/R2-compatible)

## Status

Accepted

## Context

ADR 0001 deferred cloud storage because "six existing storage services
(avatars, brand assets, drop media, product media, contract PDFs, invoice
PDFs) work against local disk today... rewriting all six call sites'
business logic... conflicts directly with 'do not rewrite existing
modules.'" That constraint hasn't changed. What's added here is the
abstraction itself, ready for those six services to adopt independently,
without forcing that migration now.

## Decision

- **`StorageProvider` interface**: `upload`, `getSignedUrl`, `delete` — the
  minimal surface every one of the six existing services already needs.
- **`LocalStorageProvider`**: real disk I/O (`node:fs/promises`) plus real
  HMAC-SHA256 signed URLs (`node:crypto`, `timingSafeEqual` for the
  comparison) — this is a genuine signed-URL implementation, not a stub,
  since local dev and self-hosted deployments are a real target, not just a
  placeholder for "S3 isn't configured."
- **`S3StorageProvider`**: `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`, `forcePathStyle` set whenever a custom
  endpoint is configured — this is what makes the same implementation work
  for both real AWS S3 and Cloudflare R2 (R2 is S3-API-compatible; the only
  difference is the endpoint and path-style addressing).
- **Config-driven selection** (`STORAGE_PROVIDER=local|s3`) via a factory
  provider bound to a `STORAGE_PROVIDER` DI token, with fail-fast validation
  if `s3` is selected without bucket/credentials — the app refuses to boot
  into a half-configured storage backend rather than failing on the first
  upload request in production.

## What was deliberately not done

The six existing storage services were **not** rewired to use
`StorageProvider` this turn. They keep their current local-disk
implementations untouched. Adopting the abstraction per-service is a
mechanical, low-risk follow-up (each service already has the same
upload/delete/signed-URL shape) — but doing all six here would mean editing
six modules' business logic in a single pass, which is the exact thing this
enterprise-pass brief rules out ("do not rewrite existing modules").

## Consequences

- New code (or a dedicated follow-up migrating one service at a time) can
  inject `STORAGE_PROVIDER` and get S3/R2 support with zero code branching
  on which backend is active.
- The six existing services are unaffected by this change; there is no
  behavior change to verify or regress against for them.
