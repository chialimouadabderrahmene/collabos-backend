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
import { OrdersAnalyticsService } from './services/orders-analytics.service';
import { OrdersSummaryResponse } from './types/analytics-response.types';

@ApiTags('analytics/orders')
@ApiBearerAuth()
@Controller('analytics/orders')
export class OrdersAnalyticsController {
  constructor(
    private readonly ordersAnalyticsService: OrdersAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get order stats for a brand' })
  @ApiResponse({ status: 200, type: OrdersSummaryResponse })
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrdersSummaryResponse> {
    return this.ordersAnalyticsService.getSummary(query, user);
  }
}
