export interface BrandMatchScoreInput {
  targetCategoryCount: number;
  overlapCategoryCount: number;
  completedDealsCount: number;
}

export function computeBrandMatchScore(input: BrandMatchScoreInput): number {
  const categoryOverlapScore =
    input.targetCategoryCount > 0
      ? (input.overlapCategoryCount / input.targetCategoryCount) * 100
      : 0;

  const trackRecordScore = Math.min(100, input.completedDealsCount * 20);

  return Math.round(categoryOverlapScore * 0.6 + trackRecordScore * 0.4);
}
