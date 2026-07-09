import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { GrowthReportQueryDto } from './dto/growth-report-query.dto';
import { ReportsService } from './services/reports.service';
import { GrowthReportResponse } from './types/admin-response.types';

@ApiTags('admin/reports')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('growth')
  @ApiOperation({
    summary:
      'Get platform-wide growth report (new users/brands/orders/revenue)',
  })
  @ApiResponse({ status: 200, type: GrowthReportResponse })
  getGrowthReport(
    @Query() query: GrowthReportQueryDto,
  ): Promise<GrowthReportResponse> {
    return this.reportsService.getGrowthReport(query);
  }
}
