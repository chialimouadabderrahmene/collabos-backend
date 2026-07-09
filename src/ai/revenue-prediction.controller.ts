import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RevenuePredictionQueryDto } from './dto/revenue-prediction-query.dto';
import { RevenuePredictionService } from './services/revenue-prediction.service';
import { RevenuePredictionResponse } from './types/ai-response.types';

@ApiTags('ai/revenue-prediction')
@ApiBearerAuth()
@Controller('ai/revenue-prediction')
export class RevenuePredictionController {
  constructor(
    private readonly revenuePredictionService: RevenuePredictionService,
  ) {}

  @Get(':brandId')
  @ApiOperation({ summary: 'Get an AI revenue projection for a brand' })
  @ApiResponse({ status: 200, type: RevenuePredictionResponse })
  getPrediction(
    @Param('brandId') brandId: string,
    @Query() query: RevenuePredictionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RevenuePredictionResponse> {
    return this.revenuePredictionService.getPrediction(brandId, query, user);
  }
}
