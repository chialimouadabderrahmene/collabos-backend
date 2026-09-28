import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateDecisionDto } from './dto/publishing.dto';
import { OpportunityDecisionsService } from './services/opportunity-decisions.service';
import { DecisionResponse } from './types/opportunity-response.types';

/**
 * R3 — Decision. GO/HOLD/NO_GO recorded by the user, pinned to a specific
 * published version. No update or delete endpoint: a changed decision is a
 * new record, not an edit to the old one.
 */
@ApiTags('opportunities/decisions')
@ApiBearerAuth()
@Controller('opportunities/:id/decisions')
export class OpportunityDecisionsController {
  constructor(private readonly decisionsService: OpportunityDecisionsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Record a GO/HOLD/NO_GO decision against a published version',
  })
  @ApiResponse({ status: 201, type: DecisionResponse })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDecisionDto,
  ): Promise<DecisionResponse> {
    return this.decisionsService.create(id, user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List decision history, newest first' })
  @ApiResponse({ status: 200, type: [DecisionResponse] })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DecisionResponse[]> {
    return this.decisionsService.list(id, user);
  }
}
