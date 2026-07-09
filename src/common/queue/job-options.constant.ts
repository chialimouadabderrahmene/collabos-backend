import { JobsOptions } from 'bullmq';

/**
 * Standard resilience defaults for queue jobs: retry transient failures with
 * exponential backoff before the job lands in the failed set (BullMQ's
 * equivalent of a dead-letter queue, inspectable via Queue#getFailed()).
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: false,
};
