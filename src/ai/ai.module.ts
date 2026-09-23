import { Module } from '@nestjs/common';
import { BrandMatchController } from './brand-match.controller';
import { DealHealthController } from './deal-health.controller';
import { LaunchReadinessController } from './launch-readiness.controller';
import { RecommendationsController } from './recommendations.controller';
import { RevenuePredictionController } from './revenue-prediction.controller';
import { AnthropicService } from './services/anthropic.service';
import { BrandMatchService } from './services/brand-match.service';
import { CacheService } from './services/cache.service';
import { DealHealthService } from './services/deal-health.service';
import { LaunchReadinessService } from './services/launch-readiness.service';
import { PromptService } from './services/prompt.service';
import { RecommendationsService } from './services/recommendations.service';
import { RevenuePredictionService } from './services/revenue-prediction.service';

@Module({
  controllers: [
    DealHealthController,
    BrandMatchController,
    RevenuePredictionController,
    LaunchReadinessController,
    RecommendationsController,
  ],
  providers: [
    AnthropicService,
    PromptService,
    CacheService,
    DealHealthService,
    BrandMatchService,
    RevenuePredictionService,
    LaunchReadinessService,
    RecommendationsService,
  ],
  exports: [AnthropicService],
})
export class AiModule {}
