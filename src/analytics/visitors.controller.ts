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
import { VisitorsService } from './services/visitors.service';
import { VisitorsSummaryResponse } from './types/analytics-response.types';

@ApiTags('analytics/visitors')
@ApiBearerAuth()
@Controller('analytics/visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get visitor stats for a brand' })
  @ApiResponse({ status: 200, type: VisitorsSummaryResponse })
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VisitorsSummaryResponse> {
    return this.visitorsService.getSummary(query, user);
  }
}
