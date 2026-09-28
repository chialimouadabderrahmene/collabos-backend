import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { selectAiClient } from './ai-provider.factory';
import { BrandMatchController } from './brand-match.controller';
import { DealHealthController } from './deal-health.controller';
import { AI_CLIENT, AiClient } from './interfaces/ai-client.interface';
import { LaunchReadinessController } from './launch-readiness.controller';
import { RecommendationsController } from './recommendations.controller';
import { RevenuePredictionController } from './revenue-prediction.controller';
import { AnthropicService } from './services/anthropic.service';
import { BrandMatchService } from './services/brand-match.service';
import { CacheService } from './services/cache.service';
import { CodeCraftService } from './services/codecraft.service';
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
    CodeCraftService,
    PromptService,
    CacheService,
    DealHealthService,
    BrandMatchService,
    RevenuePredictionService,
    LaunchReadinessService,
    RecommendationsService,
    {
      // Selects the active structured-completion provider. Defaults to the
      // existing Anthropic client — set AI_PROVIDER=codecraft to switch to
      // the CodeCraft API instead. Consumers (e.g. OpportunityAiService)
      // depend on the AiClient interface, not a concrete provider.
      provide: AI_CLIENT,
      useFactory: (
        configService: ConfigService,
        anthropic: AnthropicService,
        codecraft: CodeCraftService,
      ): AiClient =>
        selectAiClient(
          configService.get<string>('ai.provider'),
          anthropic,
          codecraft,
        ),
      inject: [ConfigService, AnthropicService, CodeCraftService],
    },
  ],
  exports: [AnthropicService, AI_CLIENT],
})
export class AiModule {}
