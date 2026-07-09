import { describe, expect, it } from 'vitest';
import { predictRevenue } from './revenue-prediction.util';

describe('predictRevenue', () => {
  it('returns a flat zero projection with no history', () => {
    const result = predictRevenue([], 3);

    expect(result).toEqual({ trend: 'flat', predicted: [0, 0, 0] });
  });

  it('repeats the single known value when there is only one data point', () => {
    const result = predictRevenue([500], 2);

    expect(result).toEqual({ trend: 'flat', predicted: [500, 500] });
  });

  it('detects an upward trend and projects growth', () => {
    const result = predictRevenue([100, 200, 300, 400], 2);

    expect(result.trend).toBe('up');
    expect(result.predicted[0]).toBeGreaterThan(400);
    expect(result.predicted[1]).toBeGreaterThan(result.predicted[0]);
  });

  it('detects a downward trend', () => {
    const result = predictRevenue([400, 300, 200, 100], 1);

    expect(result.trend).toBe('down');
    expect(result.predicted[0]).toBeLessThan(100);
  });

  it('never predicts a negative revenue', () => {
    const result = predictRevenue([100, 50, 0], 3);

    result.predicted.forEach((amount) => {
      expect(amount).toBeGreaterThanOrEqual(0);
    });
  });

  it('treats a flat history as a flat trend', () => {
    const result = predictRevenue([200, 200, 200, 200], 1);

    expect(result.trend).toBe('flat');
    expect(result.predicted).toEqual([200]);
  });
});
