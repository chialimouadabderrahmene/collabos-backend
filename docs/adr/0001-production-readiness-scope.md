# ADR 0001: Production Readiness — Scope and Deferrals

## Status

Accepted

## Context

A production-readiness audit requested implementation across 18 categories
(domain events, transactional outbox, idempotency, distributed locking,
search, file storage/CDN, observability, error monitoring, API protection,
background jobs, database tuning, performance, security, multi-environment
support, CI/CD, Kubernetes readiness, documentation, and load/chaos testing).

Implementing all 18 with full depth, tests, and zero regressions in a single
pass was not realistic without producing shallow or placeholder work, which
was explicitly out of scope. This ADR records what was built, what was
deliberately deferred, and why.

## Decision

Implemented (see Production Readiness Report for detail):

- Correlation IDs, structured per-request logging, request-scoped context
- Health check split: `/health` (full), `/health/live`, `/health/ready`
- helmet, compression, global rate limiting, hardened CORS
- Graceful shutdown (`enableShutdownHooks`)
- Stripe webhook idempotency (`WebhookEvent` dedup table)
- Client `Idempotency-Key` support on payment-creation endpoints
- Redis-backed distributed lock, applied to both Stripe webhook handlers
- BullMQ retry/backoff on existing queues; failed-job inspection surface
- Prometheus `/metrics` endpoint (default process metrics + HTTP histogram)
- Sentry error reporting (DSN-optional, safe no-op when unconfigured)
- GitHub Actions CI (lint/build/test, migration-apply check, Docker build)

Deferred (not implemented this pass):

- **Domain events / transactional outbox** — this is a cross-cutting
  architectural pattern that would touch every module's write paths (Orders,
  Payments, Deals, Drops, etc.) to publish events on state transitions. Doing
  it properly requires an Outbox table, a background publisher with its own
  retry/backoff, and per-module event definitions — effectively its own
  module-sized turn, not a bolt-on. Retrofitting it partially (e.g. only for
  Payments) would leave the pattern inconsistent and half-adopted across the
  codebase, which is worse than not having it.
- **Search layer (Typesense/Meilisearch)** — introduces a new stateful
  external service with its own indexing lifecycle, re-index jobs, and
  index-consistency-on-write hooks in Products/Drops/Brands. No existing
  scaffolding to build on; needs dedicated design.
- **Cloud file storage / signed URLs / CDN abstraction** — six existing
  storage services (avatars, brand assets, drop media, product media,
  contract PDFs, invoice PDFs) work against local disk today. Introducing a
  `StorageProvider` interface and cloud backend would mean rewriting all six
  call sites' business logic, which conflicts directly with "do not rewrite
  existing modules." Recommended as a dedicated follow-up module.
- **Full distributed tracing (OpenTelemetry + collector)** — requires an
  external trace collector (Jaeger/Tempo/etc.) that doesn't exist in this
  environment; correlation IDs and Prometheus timing histograms cover the
  most immediately useful subset without a phantom dependency.
- **Kubernetes manifests** — this repo is a single deployable service with a
  Dockerfile and docker-compose for local dev; no cluster/Helm chart context
  exists to size resource limits or replica counts against. The code-level
  readiness/liveness endpoints and graceful shutdown are the portable parts;
  actual manifests belong in a deploy repo alongside real resource
  measurements.
- **Load/stress/chaos tests** — require a running, deployed target and
  tooling decision (k6 vs. Artillery) with real traffic assumptions;
  scaffolding one against nothing would be a placeholder.
- **N+1 query detection, full OWASP review, dependency vulnerability fixes**
  — flagged in the report as findings, not fixed blind (dependency upgrades
  in particular can be breaking; `npm audit fix --force` was deliberately not
  run here).

## Consequences

The deferred items are the right size for dedicated follow-up turns, mirroring
how every other module in this codebase was built. Attempting them here would
have meant either skipping tests (violates the brief) or shipping partial,
untested infrastructure (also violates the brief, and is worse than not
shipping it).
