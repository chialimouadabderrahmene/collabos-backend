import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListOutboxQueryDto } from './dto/list-outbox-query.dto';
import { ReplaySinceQueryDto } from './dto/replay-since-query.dto';
import { OutboxQueryService } from './outbox-query.service';
import { ReplayService } from './replay.service';
import {
  OutboxEventResponse,
  PaginatedOutboxEventsResponse,
} from './types/outbox-event-response.types';
import {
  ReplayResultResponse,
  ReplaySummaryResponse,
} from './types/replay-response.types';

@ApiTags('events/outbox')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('events/outbox')
export class OutboxController {
  constructor(
    private readonly outboxQueryService: OutboxQueryService,
    private readonly replayService: ReplayService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List outbox events (includes the dead-letter queue via status=FAILED)',
  })
  @ApiResponse({ status: 200, type: PaginatedOutboxEventsResponse })
  findAll(
    @Query() query: ListOutboxQueryDto,
  ): Promise<PaginatedOutboxEventsResponse> {
    return this.outboxQueryService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an outbox event' })
  @ApiResponse({ status: 200, type: OutboxEventResponse })
  findOne(@Param('id') id: string): Promise<OutboxEventResponse> {
    return this.outboxQueryService.findOneOrThrow(id);
  }

  @Post(':id/replay')
  @RequirePermissions('events:replay')
  @ApiOperation({
    summary: 'Replay a single event (handlers must be idempotent)',
  })
  @ApiResponse({ status: 200, type: ReplayResultResponse })
  async replayOne(@Param('id') id: string): Promise<ReplayResultResponse> {
    const republished = await this.replayService.replayById(id);
    return { republished };
  }

  @Post('replay')
  @RequirePermissions('events:replay')
  @ApiOperation({
    summary:
      'Replay every event since a given time, optionally filtered by status',
  })
  @ApiResponse({ status: 200, type: ReplaySummaryResponse })
  replaySince(
    @Body() dto: ReplaySinceQueryDto,
  ): Promise<ReplaySummaryResponse> {
    const since = dto.since ? new Date(dto.since) : new Date(0);
    return this.replayService.replaySince(since, dto.status);
  }
}
