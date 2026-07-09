export const OUTBOX_QUEUE = 'outbox';
export const DISPATCH_OUTBOX_EVENT_JOB = 'dispatch-outbox-event';
export const POLL_OUTBOX_JOB = 'poll-outbox';
export const POLL_OUTBOX_REPEAT_JOB_ID = 'poll-outbox-repeat';

export interface DispatchOutboxEventJobData {
  outboxEventId: string;
}

/** Safety-net poll interval: catches events whose fast-path enqueue was
 * lost (e.g. the process crashed between commit and enqueue). */
export const POLL_INTERVAL_MS = 30000;

/** Only re-enqueue PENDING rows older than this — anything younger is still
 * within the fast-path's normal window and doesn't need help yet. */
export const POLL_GRACE_PERIOD_MS = 10000;
