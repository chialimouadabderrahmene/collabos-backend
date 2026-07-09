import { describe, expect, it } from 'vitest';
import { resolveDateRange } from './resolve-date-range.util';

describe('resolveDateRange', () => {
  it('defaults to a 90 day window ending now when nothing is given', () => {
    const before = Date.now();
    const { from, to } = resolveDateRange({});
    const after = Date.now();

    expect(to.getTime()).toBeGreaterThanOrEqual(before);
    expect(to.getTime()).toBeLessThanOrEqual(after);
    expect(to.getTime() - from.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('uses the given from/to when provided', () => {
    const { from, to } = resolveDateRange({
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(from).toEqual(new Date('2026-01-01'));
    expect(to).toEqual(new Date('2026-01-31'));
  });
});
