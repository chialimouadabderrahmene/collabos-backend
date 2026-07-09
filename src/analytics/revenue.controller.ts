import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsSeriesQueryDto } from './dto/analytics-series-query.dto';
import { RevenueService } from './services/revenue.service';
import {
  RevenueSeriesPointResponse,
  RevenueSummaryResponse,
} from './types/analytics-response.types';

@ApiTags('analytics/revenue')
@ApiBearerAuth()
@Controller('analytics/revenue')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get()
  @ApiOperation({ summary: 'Get revenue summary for a brand' })
  @ApiResponse({ status: 200, type: RevenueSummaryResponse })
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RevenueSummaryResponse> {
    return this.revenueService.getSummary(query, user);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get revenue chart series for a brand' })
  @ApiResponse({ status: 200, type: [RevenueSeriesPointResponse] })
  getSeries(
    @Query() query: AnalyticsSeriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RevenueSeriesPointResponse[]> {
    return this.revenueService.getSeries(query, user);
  }
}
