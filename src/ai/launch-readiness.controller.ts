import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { LaunchReadinessService } from './services/launch-readiness.service';
import { LaunchReadinessResponse } from './types/ai-response.types';

@ApiTags('ai/launch-readiness')
@ApiBearerAuth()
@Controller('ai/launch-readiness')
export class LaunchReadinessController {
  constructor(
    private readonly launchReadinessService: LaunchReadinessService,
  ) {}

  @Get(':dropId')
  @ApiOperation({ summary: 'Get an AI launch readiness score for a drop' })
  @ApiResponse({ status: 200, type: LaunchReadinessResponse })
  getReadiness(
    @Param('dropId') dropId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LaunchReadinessResponse> {
    return this.launchReadinessService.getReadiness(dropId, user);
  }
}
