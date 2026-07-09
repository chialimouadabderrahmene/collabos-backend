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
import { TrafficService } from './services/traffic.service';
import {
  TrafficSeriesPointResponse,
  TrafficSummaryResponse,
} from './types/analytics-response.types';

@ApiTags('analytics/traffic')
@ApiBearerAuth()
@Controller('analytics/traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get()
  @ApiOperation({ summary: 'Get traffic summary for a brand' })
  @ApiResponse({ status: 200, type: TrafficSummaryResponse })
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrafficSummaryResponse> {
    return this.trafficService.getSummary(query, user);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get traffic chart series for a brand' })
  @ApiResponse({ status: 200, type: [TrafficSeriesPointResponse] })
  getSeries(
    @Query() query: AnalyticsSeriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrafficSeriesPointResponse[]> {
    return this.trafficService.getSeries(query, user);
  }
}
