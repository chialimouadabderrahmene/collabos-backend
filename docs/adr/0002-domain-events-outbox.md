# ADR 0002: Domain Events via Transactional Outbox

## Status

Accepted

## Context

The brief asked for domain events (`@nestjs/cqrs`), an event bus, a
transactional outbox, an outbox publisher, event replay, and a dead-letter
queue — deferred in ADR 0001 as "effectively its own module-sized turn."

The core problem an outbox solves: a business mutation (e.g. "payment
succeeded") and the fact that an event should be published about it must
either both happen or neither happen. Publishing directly from the request
handler (`eventBus.publish(...)` right after `prisma.payment.update(...)`)
has a gap — if the process crashes between the DB write and the publish
call, the event is lost forever with no record it should have existed.

## Decision

- **`OutboxEvent` table** (`aggregateType`, `aggregateId`, `eventType`,
  `payload` JSON, `status: PENDING|PUBLISHED|FAILED`, `attempts`,
  `lastError`). Callers write the outbox row in the *same*
  `prisma.$transaction([...])` array as their business mutation — the event
  record durably exists if and only if the mutation committed.
- **`OutboxPublisherService`** fast-path enqueues a BullMQ dispatch job
  (`jobId: outboxEventId`, natural dedup) immediately after the transaction
  commits, plus a repeatable poll job (every 30s, grace period 10s) that
  picks up any PENDING row the fast path failed to enqueue (process crash
  between commit and enqueue) — the poller is the safety net, not the
  primary path.
- **`OutboxProcessor`** (`@Processor`) loads the row, no-ops if it's not
  PENDING (idempotent against double dispatch), resolves the concrete event
  class via `DomainEventRegistry`, calls `eventBus.publish(event)`, marks
  PUBLISHED. On error it increments `attempts`/`lastError` and rethrows so
  BullMQ retries with exponential backoff.
- **Dead-letter queue**: reuses BullMQ's own failed-job set
  (`removeOnFail: false`) rather than a second queue. A
  `@QueueEventsListener` + `@OnQueueEvent('failed')` handler fires only once
  BullMQ exhausts all attempts, marking `OutboxEvent.status = FAILED`. The
  existing `GET /events/outbox?status=FAILED` view *is* the DLQ browser —
  no separate DLQ table or endpoint was needed.
- **`DomainEventRegistry`**: a generic map from `eventType` string back to a
  concrete event-class factory, populated by each event-owning handler
  registering itself in its own constructor. This keeps the generic
  outbox/publisher/processor code decoupled from any specific module's event
  classes — new modules opt in without editing shared infrastructure.
- **Replay** (`ReplayService.replayById` / `replaySince`) re-publishes stored
  events via `EventBus` *without* mutating the original row's
  status/publishedAt.

## A hard constraint this design accepts

`@nestjs/cqrs`'s `EventBus.publish()` does not await or propagate handler
exceptions back to the caller (verified by reading
`node_modules/@nestjs/cqrs/dist/event-bus.js` — it delegates to an in-memory
RxJS `Subject`). This means:

- "PUBLISHED" means *"successfully handed to the bus,"* not *"every handler
  succeeded."* There is no stronger guarantee available without replacing
  `@nestjs/cqrs`'s event bus entirely, which was out of scope.
- Every `@EventsHandler` must therefore be self-contained: catch its own
  errors and log them rather than throwing, and be safe to receive the same
  event twice (replay and the DLQ don't get a "did it actually work"
  signal — they can only redeliver).
- `PaymentSucceededHandler` (the one reference integration, see ADR 0003)
  follows this: it writes an audit log row and swallows any failure with a
  log line.

## Consequences

- Any module can adopt the outbox pattern by: (1) writing an `OutboxEvent`
  row in its own transaction via `OutboxService.enqueue(...)`, (2) calling
  `outboxPublisherService.scheduleDispatch(id)` for the fast path, (3)
  defining an `IEvent` class + `@EventsHandler` that registers itself with
  `DomainEventRegistry`. Only Payments does this today (ADR 0003) —
  everywhere else is unchanged, so there is no risk of a half-migrated event
  model across modules that don't need one yet.
- At-least-once delivery only. Handlers cannot be written assuming
  exactly-once semantics.
