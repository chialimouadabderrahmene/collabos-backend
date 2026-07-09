import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PayoutReportQueryDto } from './dto/payout-report-query.dto';
import { ReportsService } from './services/reports.service';
import { PayoutReportResponse } from './types/payout-response.types';

@ApiTags('payouts/reports')
@ApiBearerAuth()
@Controller('payouts/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get my earnings and withdrawal summary' })
  @ApiResponse({ status: 200, type: PayoutReportResponse })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PayoutReportQueryDto,
  ): Promise<PayoutReportResponse> {
    return this.reportsService.getSummary(user.id, query);
  }
}
