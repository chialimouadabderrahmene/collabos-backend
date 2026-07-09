# ADR 0005: OpenTelemetry Distributed Tracing

## Status

Accepted

## Context

ADR 0001 deferred full distributed tracing because "requires an external
trace collector (Jaeger/Tempo/etc.) that doesn't exist in this
environment." The brief in this turn asks for OpenTelemetry specifically,
so the design had to produce real, useful spans *without* assuming a
collector is deployed.

## Decision

- **`@opentelemetry/sdk-node` + `auto-instrumentations-node`** auto-patches
  http, express, and other supported libraries with zero manual span
  creation in application code.
- **Console exporter by default** (`ConsoleSpanExporter`): real spans are
  produced and printed to stdout — this is a working tracing setup for local
  dev and for eyeballing trace shape, not a stub. It switches to
  **OTLP/HTTP** (`OTLPTraceExporter`) automatically once
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set, at which point spans go to whatever
  collector that endpoint points at (Jaeger, Tempo, a vendor OTLP
  ingest, etc.) with no code change.
- **Initialization must happen before any instrumented module is
  `require`'d.** `src/observability/tracing/tracing-init.ts` is a
  side-effect module (calls `sdk.start()` at import time) and is imported as
  the literal first line of `src/main.ts`, ahead of `@nestjs/core` and every
  other import. TypeScript compiles `import` statements to `require()` calls
  executed top-to-bottom in file order, so this ordering is load-bearing —
  moving the import down the file would silently disable instrumentation for
  every module required above it.
- `createTracingSdk()` / `buildTraceExporter()` are exported as pure
  functions from `tracing.ts` specifically so they're unit-testable; the
  side-effecting `tracing-init.ts` itself is intentionally untested (same
  reasoning as `main.ts` — it's wiring, not logic).

## Consequences

- Zero external dependencies required to get value from this — spans show
  up in server logs today. Wiring a real collector later is a one-env-var
  change (`OTEL_EXPORTER_OTLP_ENDPOINT`), not a code change.
- Anyone adding a new entry point (a CLI script, a worker process) that
  should also be traced must remember the same "import tracing-init first"
  rule — it is not automatic via `AppModule` registration, because
  by the time Nest resolves providers, the modules to instrument have
  already been required.
