import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './services/dashboard.service';
import { DashboardResponse } from './types/admin-response.types';

@ApiTags('admin/dashboard')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform-wide dashboard metrics' })
  @ApiResponse({ status: 200, type: DashboardResponse })
  getOverview(): Promise<DashboardResponse> {
    return this.dashboardService.getOverview();
  }
}
