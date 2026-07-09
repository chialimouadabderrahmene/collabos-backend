import { ApiProperty } from '@nestjs/swagger';

export class DealHealthResponse {
  @ApiProperty()
  dealId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: [String] })
  riskFactors!: string[];

  @ApiProperty()
  narrative!: string;

  @ApiProperty()
  generatedByAi!: boolean;

  @ApiProperty()
  cached!: boolean;
}

export class BrandMatchResponse {
  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: [String] })
  overlapCategories!: string[];

  @ApiProperty()
  narrative!: string;

  @ApiProperty()
  generatedByAi!: boolean;

  @ApiProperty()
  cached!: boolean;
}

export class RevenuePredictionPointResponse {
  @ApiProperty()
  period!: string;

  @ApiProperty()
  amount!: number;
}

export class RevenuePredictionResponse {
  @ApiProperty()
  brandId!: string;

  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  trend!: 'up' | 'down' | 'flat';

  @ApiProperty({ type: [RevenuePredictionPointResponse] })
  history!: RevenuePredictionPointResponse[];

  @ApiProperty({ type: [RevenuePredictionPointResponse] })
  predicted!: RevenuePredictionPointResponse[];

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  narrative!: string;

  @ApiProperty()
  generatedByAi!: boolean;

  @ApiProperty()
  cached!: boolean;
}

export class LaunchReadinessResponse {
  @ApiProperty()
  dropId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: [String] })
  blockers!: string[];

  @ApiProperty()
  narrative!: string;

  @ApiProperty()
  generatedByAi!: boolean;

  @ApiProperty()
  cached!: boolean;
}

export class RecommendationResponse {
  @ApiProperty()
  briefId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  brandName!: string;

  @ApiProperty()
  briefTitle!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: [String] })
  overlapCategories!: string[];

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  generatedByAi!: boolean;
}

export class RecommendationsResponse {
  @ApiProperty({ type: [RecommendationResponse] })
  data!: RecommendationResponse[];

  @ApiProperty()
  cached!: boolean;
}
