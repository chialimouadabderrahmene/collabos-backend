import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
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
import { SaveDraftDto } from './dto/opportunity.dto';
import { PublishOpportunityDto } from './dto/publishing.dto';
import { OpportunityDraftService } from './services/opportunity-draft.service';
import { OpportunityPublishService } from './services/opportunity-publish.service';
import {
  DraftResponse,
  VersionResponse,
  VersionSummaryResponse,
} from './types/opportunity-response.types';

@ApiTags('opportunities/content')
@ApiBearerAuth()
@Controller('opportunities/:id')
export class OpportunityContentController {
  constructor(
    private readonly draftService: OpportunityDraftService,
    private readonly publishService: OpportunityPublishService,
  ) {}

  @Get('draft')
  @ApiOperation({ summary: 'Get the working draft' })
  @ApiResponse({ status: 200, type: DraftResponse })
  getDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DraftResponse> {
    return this.draftService.get(id, user);
  }

  @Put('draft')
  @ApiOperation({
    summary:
      'Save the draft (optimistic concurrency via baseRevision; 409 on conflict)',
  })
  @ApiResponse({ status: 200, type: DraftResponse })
  saveDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveDraftDto,
  ): Promise<DraftResponse> {
    return this.draftService.save(id, user, dto);
  }

  @Post('publish')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Publish the draft as a new immutable version (N+1)',
  })
  @ApiResponse({ status: 201, type: VersionResponse })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PublishOpportunityDto,
  ): Promise<VersionResponse> {
    return this.publishService.publish(id, user, dto);
  }

  @Get('versions')
  @ApiOperation({ summary: 'List published versions (newest first)' })
  @ApiResponse({ status: 200, type: [VersionSummaryResponse] })
  listVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VersionSummaryResponse[]> {
    return this.publishService.listVersions(id, user);
  }

  @Get('versions/:versionNumber')
  @ApiOperation({ summary: 'Get one immutable published version' })
  @ApiResponse({ status: 200, type: VersionResponse })
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VersionResponse> {
    return this.publishService.getVersion(id, versionNumber, user);
  }
}
