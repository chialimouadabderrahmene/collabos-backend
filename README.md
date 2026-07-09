# CollabOS Backend

A NestJS/Prisma/PostgreSQL backend for a fashion collaboration marketplace
connecting brands and creators — briefs, applications, deals, contracts,
product drops, orders, Stripe payments/payouts, messaging, and an
AI-assisted matching layer, plus the enterprise infrastructure (event
sourcing, search, observability, RBAC) needed to run it in production.

## How this was built

This project was built **module by module**, not as one big scaffold. Each
domain module (auth, users, brands, briefs, applications, messaging, deals,
contracts, drops, products, orders, payments, payouts, analytics,
notifications, ai, admin) was implemented as its own self-contained pass:
schema changes for that module, services, controllers, DTOs, Swagger docs,
and a full Vitest suite with a mocked Prisma client — verified (lint, build,
tests) before moving to the next module. A Prisma migration was regenerated
after every schema change via:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

After the feature set was complete, two further passes hardened it for
production:

1. **Production readiness audit** — correlation IDs & structured request
   logging, health probes (`/health/live`, `/health/ready`), API protection
   (helmet, compression, rate limiting, hardened CORS), graceful shutdown,
   webhook idempotency, a distributed Redis lock, queue retry/backoff,
   Prometheus metrics, Sentry error monitoring, and CI (GitHub Actions).
   See [`docs/adr/0001-production-readiness-scope.md`](docs/adr/0001-production-readiness-scope.md)
   for exactly what was in scope and what was deliberately deferred.
2. **Final enterprise architecture pass** — domain events via
   `@nestjs/cqrs`, a transactional outbox with a BullMQ-backed publisher,
   event replay, a dead-letter queue, a Typesense search layer, an
   S3/R2-compatible storage provider abstraction, OpenTelemetry distributed
   tracing, and a fine-grained RBAC permission system. Every decision here
   is written up as an ADR in [`docs/adr/`](docs/adr/), and the event
   pipeline is diagrammed in [`docs/EVENT_FLOW.md`](docs/EVENT_FLOW.md).

Two rules were followed throughout the hardening passes: **never rewrite a
working module**, and **never ship a placeholder**. Where a "real"
implementation would have meant rewriting existing modules end to end (e.g.
wiring cloud storage into all 6 existing upload services, or adding
Prisma write-hooks for real-time search indexing), the ADRs document why a
narrower, non-breaking design was chosen instead — e.g. search uses a
watermark-based incremental sync rather than write hooks, because
**Prisma 6.19 removed `$use()` middleware entirely**, and rewriting
`PrismaService` (injected at 300+ call sites) was judged too risky for a
"no breaking changes" pass.

## Cross-module design principle

Modules never import each other's services. If module B needs data owned
by module A, it reads/writes A's Prisma tables directly through the shared
`PrismaService` rather than depending on A's service layer. Anything that
would otherwise be shared infrastructure (auth helpers, storage logic) is
independently reimplemented per module rather than creating cross-module
coupling. This keeps each module's tests fully isolated (mocked Prisma,
no real database) and means no module can break another module's public
API by accident.

## Stack

- **Framework**: NestJS 11 (Express), TypeScript 5.7
- **Database**: PostgreSQL via Prisma 6 (61 models)
- **Cache / queues**: Redis + BullMQ
- **Auth**: JWT (access + refresh), global `JwtAuthGuard` + `RolesGuard` +
  `PermissionsGuard`, `@Public()` / `@Roles()` / `@RequirePermissions()`
- **Payments**: Stripe (Connect, webhooks, idempotent processing)
- **Search**: Typesense (optional — degrades honestly, not silently, when
  unconfigured)
- **Storage**: local disk or S3/R2-compatible, config-selected
- **Observability**: Prometheus (`/metrics`), Sentry, OpenTelemetry tracing,
  correlation-ID structured logging
- **Testing**: Vitest, Prisma fully mocked — no test hits a real database
- **CI**: GitHub Actions (lint, build, test, migration-apply check, Docker
  build)

## Project structure

```
src/
  auth/ users/ brands/ briefs/ applications/ messaging/ deals/
  contracts/ drops/ products/ orders/ payments/ payouts/ analytics/
  notifications/ ai/ admin/          # feature modules, one per domain
  events/                            # domain events + transactional outbox
  search/                            # Typesense + incremental reindexing
  storage/                           # StorageProvider abstraction (local/S3)
  observability/                     # metrics, tracing, Sentry init
  common/ config/ prisma/ redis/ queue/  # shared infrastructure
docs/
  adr/                               # architecture decision records
  EVENT_FLOW.md                      # event pipeline diagrams
  DEPLOYMENT.md
prisma/
  schema.prisma
  migrations/
```

## Running it

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, JWT secrets, etc.
npx prisma migrate deploy
npx prisma db seed         # seeds base roles + the permission catalog
npm run start:dev
```

```bash
npm run lint
npm run build
npx vitest run              # full test suite, no database required
```

Swagger docs are served at `/api/docs` when `SWAGGER_ENABLED=true`.

## License

Private project. Not for redistribution.
