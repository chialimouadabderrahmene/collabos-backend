# Deployment Guide

## Required environment variables

See `.env.example` for the full list with defaults. At minimum, production
needs: `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `SMTP_*`, `ORDERS_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYOUTS_WEBHOOK_SECRET`. Everything else
(Anthropic, push provider, Sentry) is optional and fails safe when unset.

## Migrations

```bash
npm run prisma:deploy   # applies committed migrations, never generates new ones in prod
```

Never run `prisma migrate dev` against a production database — it can prompt
for destructive resets. `prisma migrate deploy` only applies pending
migrations and is safe for CI/CD.

## Build

```bash
npm ci
npm run prisma:generate
npm run build
```

The Dockerfile does this in a multi-stage build; `docker build -t collabos-backend .`
produces a production image. `docker-compose.yml` wires it up with Postgres
and Redis for local/staging use.

## Health and readiness

- `GET /health/live` — process liveness only (no external deps). Use for a
  container/orchestrator liveness probe; failing this should restart the pod.
- `GET /health/ready` — database + Redis + disk. Use for a readiness probe;
  failing this should pull the instance out of the load balancer, not restart
  it.
- `GET /health` — full check (both of the above plus memory), useful for a
  general uptime monitor hitting one endpoint.

All three are public (no auth) and version-neutral (`/health/*`, not
`/v1/health/*`), so probe configuration doesn't need to track API versioning.

## Graceful shutdown

The app calls `enableShutdownHooks()`, so on `SIGTERM` (what Docker/Kubernetes
send on pod termination) Nest runs every module's `onModuleDestroy` — Prisma
and Redis close their connections cleanly. Give the container a termination
grace period long enough for in-flight requests and BullMQ jobs to finish
(15–30s is a reasonable starting point; tune based on observed request/job
durations in `/metrics`).

## Observability

- `GET /metrics` — Prometheus exposition format (default process metrics +
  `http_request_duration_seconds` histogram labeled by method/route/status).
  Point a Prometheus scrape config at this path; it's public and
  version-neutral like the health endpoints.
- `GET /observability/queues` (admin-only) — BullMQ job counts (waiting,
  active, completed, failed, delayed) per queue, for a quick "is anything
  stuck" check without shelling into Redis.
- Every response carries `X-Request-Id` (client-supplied or generated); it's
  also included in structured error responses and log lines, so a single ID
  ties a client report to server logs and Sentry events.
- Set `SENTRY_DSN` to enable error reporting for 5xx responses; leave it
  unset in local/CI and errors just log normally.

## Rate limiting

Global default is `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` per client
(100 req/60s out of the box). Tune per environment via env vars, not code.

## Idempotency

Send an `Idempotency-Key` header on `POST /payments/orders` and
`POST /payments/deals` to make retries safe — a replayed key returns the
original response instead of re-running the handler. Stripe webhooks are
deduplicated server-side by event ID; no client action needed there.
