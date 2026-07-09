import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ConversionService } from './services/conversion.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ConversionResponse } from './types/analytics-response.types';

@ApiTags('analytics/conversion')
@ApiBearerAuth()
@Controller('analytics/conversion')
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Get()
  @ApiOperation({ summary: 'Get visitor-to-order conversion rate for a brand' })
  @ApiResponse({ status: 200, type: ConversionResponse })
  getConversion(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversionResponse> {
    return this.conversionService.getConversion(query, user);
  }
}
