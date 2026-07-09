import { Controller, Get, Header, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ReportsService } from './services/reports.service';
import { AnalyticsReportResponse } from './types/analytics-response.types';

@ApiTags('analytics/reports')
@ApiBearerAuth()
@Controller('analytics/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Get a combined revenue/orders/traffic/visitors report for a brand',
  })
  @ApiResponse({ status: 200, type: AnalyticsReportResponse })
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnalyticsReportResponse> {
    return this.reportsService.getSummary(query, user);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="analytics-report.csv"')
  @ApiOperation({ summary: 'Download a daily CSV report for a brand' })
  getExport(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string> {
    return this.reportsService.exportCsv(query, user);
  }
}
