import { describe, expect, it } from 'vitest';
import { computeBrandMatchScore } from './brand-match-score.util';

describe('computeBrandMatchScore', () => {
  it('scores 0 when there is no overlap and no track record', () => {
    const score = computeBrandMatchScore({
      targetCategoryCount: 3,
      overlapCategoryCount: 0,
      completedDealsCount: 0,
    });

    expect(score).toBe(0);
  });

  it('weighs full category overlap and full track record at 100', () => {
    const score = computeBrandMatchScore({
      targetCategoryCount: 3,
      overlapCategoryCount: 3,
      completedDealsCount: 5,
    });

    expect(score).toBe(100);
  });

  it('gives 0 category-overlap score when the brand has no categories', () => {
    const score = computeBrandMatchScore({
      targetCategoryCount: 0,
      overlapCategoryCount: 0,
      completedDealsCount: 5,
    });

    expect(score).toBe(40);
  });

  it('caps the track record contribution at 5 completed deals', () => {
    const score = computeBrandMatchScore({
      targetCategoryCount: 0,
      overlapCategoryCount: 0,
      completedDealsCount: 10,
    });

    expect(score).toBe(40);
  });

  it('blends partial overlap and partial track record', () => {
    const score = computeBrandMatchScore({
      targetCategoryCount: 2,
      overlapCategoryCount: 1,
      completedDealsCount: 2,
    });

    // categoryOverlapScore = 50 * 0.6 = 30, trackRecordScore = 40 * 0.4 = 16 -> 46
    expect(score).toBe(46);
  });
});
