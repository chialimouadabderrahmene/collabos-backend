# Event Flow

Diagrams for the domain event / transactional outbox pipeline introduced in
[ADR 0002](adr/0002-domain-events-outbox.md) (whose one reference
integration is the Payments `PAYMENT_SUCCEEDED` event), and the search
incremental-sync pipeline from [ADR 0003](adr/0003-typesense-search-layer.md).

## 1. Publish path (happy path)

```mermaid
sequenceDiagram
    participant Handler as PaymentsWebhookService
    participant DB as Postgres
    participant Outbox as OutboxService
    participant Publisher as OutboxPublisherService
    participant Queue as BullMQ (outbox queue)
    participant Processor as OutboxProcessor
    participant Bus as EventBus (@nestjs/cqrs)
    participant EH as PaymentSucceededHandler

    Handler->>DB: prisma.$transaction([<br/>  payment.update(...),<br/>  outboxEvent.create(...)<br/>])
    DB-->>Handler: commit (both rows or neither)
    Handler->>Publisher: scheduleDispatch(outboxEventId)
    Publisher->>Queue: add(DISPATCH_JOB, {id}, jobId: outboxEventId)
    Queue->>Processor: process(job)
    Processor->>DB: load OutboxEvent by id
    Note over Processor: no-op if status != PENDING (idempotent)
    Processor->>Bus: publish(event) via DomainEventRegistry
    Bus-->>EH: handle(event)
    EH->>DB: audit log write
    Note over EH: catches its own errors — EventBus does<br/>not propagate handler exceptions back
    Processor->>DB: mark OutboxEvent PUBLISHED
```

## 2. Safety-net poller (fast path missed)

```mermaid
sequenceDiagram
    participant Scheduler as OutboxPublisherService (OnModuleInit)
    participant Queue as BullMQ (outbox queue)
    participant DB as Postgres

    Scheduler->>Queue: register repeatable POLL job (every 30s)
    loop every 30s
        Queue->>Scheduler: poll job fires
        Scheduler->>DB: find PENDING rows older than 10s grace period
        Scheduler->>Queue: enqueue dispatch job per row (jobId: row.id)
    end
```

The grace period exists so a row that's mid-fast-path (just committed,
dispatch job about to be enqueued) isn't double-enqueued by the poller
racing it.

## 3. Failure → dead-letter queue

```mermaid
sequenceDiagram
    participant Queue as BullMQ (outbox queue)
    participant Processor as OutboxProcessor
    participant DB as Postgres
    participant DLQ as OutboxDeadLetterListener

    Queue->>Processor: process(job), attempt N
    Processor--xQueue: throws (handler/registry error)
    Note over Queue: BullMQ retries with exponential backoff<br/>(DEFAULT_JOB_OPTIONS: attempts=3)
    Queue->>Queue: attempts exhausted
    Queue->>DLQ: @OnQueueEvent('failed')
    DLQ->>DB: mark OutboxEvent FAILED
```

`FAILED` rows are browsable via `GET /events/outbox?status=FAILED` — this
list *is* the dead-letter queue view; there is no separate DLQ table.

## 4. Manual replay

```mermaid
sequenceDiagram
    participant Admin
    participant Controller as OutboxController
    participant Replay as ReplayService
    participant DB as Postgres
    participant Bus as EventBus

    Admin->>Controller: POST /events/outbox/:id/replay<br/>(requires events:replay permission)
    Controller->>Replay: replayById(id)
    Replay->>DB: load OutboxEvent (any status)
    Replay->>Bus: publish(event) via DomainEventRegistry
    Note over Replay: does NOT mutate status/publishedAt —<br/>at-least-once redelivery, nothing stronger
    Replay-->>Controller: republished: boolean
```

## 5. Search incremental sync (separate pipeline, same "async catch-up" shape)

```mermaid
sequenceDiagram
    participant Scheduler as ReindexSchedulerService (OnModuleInit)
    participant Queue as BullMQ (search-reindex queue)
    participant Processor as ReindexProcessor
    participant Reindex as ReindexService
    participant DB as Postgres
    participant TS as Typesense

    Scheduler->>Queue: register repeatable REINDEX job (every TYPESENSE_REINDEX_INTERVAL_MS)
    Queue->>Processor: process(job)
    Processor->>Reindex: reindexIncremental()
    loop per collection (products, brands, drops)
        Reindex->>DB: SearchSyncState.lastSyncedAt (cursor)
        Reindex->>DB: findMany where updatedAt >= cursor
        Reindex->>TS: upsert changed documents
        Reindex->>DB: advance cursor to sync-start timestamp
    end
```

Not a write-hook (Prisma 6.19 removed `$use()` middleware — see ADR 0003) —
this is a scheduled catch-up, at most one reindex interval of staleness.
