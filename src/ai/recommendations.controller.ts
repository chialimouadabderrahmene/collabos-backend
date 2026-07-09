import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RecommendationsQueryDto } from './dto/recommendations-query.dto';
import { RecommendationsService } from './services/recommendations.service';
import { RecommendationsResponse } from './types/ai-response.types';

@ApiTags('ai/recommendations')
@ApiBearerAuth()
@Controller('ai/recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get AI-recommended open briefs for me' })
  @ApiResponse({ status: 200, type: RecommendationsResponse })
  getRecommendations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponse> {
    return this.recommendationsService.getRecommendations(user, query);
  }
}
