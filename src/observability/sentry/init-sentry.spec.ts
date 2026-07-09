import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initSentry } from './init-sentry';

vi.mock('@sentry/node', () => ({ init: vi.fn() }));

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not initialize Sentry when no DSN is configured', () => {
    initSentry({ dsn: undefined, environment: 'test', tracesSampleRate: 0.1 });

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured DSN and sample rate', () => {
    initSentry({
      dsn: 'https://example.ingest.sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0.2,
    });

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://example.ingest.sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0.2,
    });
  });
});
