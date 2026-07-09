import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DealHealthService } from './services/deal-health.service';
import { DealHealthResponse } from './types/ai-response.types';

@ApiTags('ai/deal-health')
@ApiBearerAuth()
@Controller('ai/deal-health')
export class DealHealthController {
  constructor(private readonly dealHealthService: DealHealthService) {}

  @Get(':dealId')
  @ApiOperation({ summary: 'Get an AI-scored health assessment for a deal' })
  @ApiResponse({ status: 200, type: DealHealthResponse })
  getHealth(
    @Param('dealId') dealId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealHealthResponse> {
    return this.dealHealthService.getHealth(dealId, user);
  }
}
