import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB_OPTIONS } from './job-options.constant';

describe('DEFAULT_JOB_OPTIONS', () => {
  it('retries transient failures with exponential backoff', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
  });

  it('keeps failed jobs around for inspection instead of auto-removing them', () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBe(false);
  });
});
