import { describe, expect, it } from 'vitest';
import { getRequestId, requestContext } from './request-context';

describe('requestContext', () => {
  it('returns undefined when called outside of a request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('returns the stored requestId inside requestContext.run', () => {
    requestContext.run({ requestId: 'req-123' }, () => {
      expect(getRequestId()).toBe('req-123');
    });
  });

  it('isolates concurrent contexts from each other', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'a' }, () => {
          setTimeout(() => {
            results.push(getRequestId() as string);
            resolve();
          }, 10);
        });
      }),
      new Promise<void>((resolve) => {
        requestContext.run({ requestId: 'b' }, () => {
          setTimeout(() => {
            results.push(getRequestId() as string);
            resolve();
          }, 5);
        });
      }),
    ]);

    expect(results.sort()).toEqual(['a', 'b']);
  });
});
