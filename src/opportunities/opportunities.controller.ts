import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AddOpportunityMemberDto,
  CreateOpportunityDto,
  ListOpportunitiesQueryDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { OpportunitiesService } from './services/opportunities.service';
import { OpportunityActivityService } from './services/opportunity-activity.service';
import { OpportunityMembersService } from './services/opportunity-members.service';
import {
  MessageResponse,
  OpportunityMemberResponse,
  OpportunityResponse,
  PaginatedActivityResponse,
  PaginatedOpportunitiesResponse,
} from './types/opportunity-response.types';

@ApiTags('opportunities')
@ApiBearerAuth()
@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly membersService: OpportunityMembersService,
    private readonly activityService: OpportunityActivityService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an opportunity (brand editor+)' })
  @ApiResponse({ status: 201, type: OpportunityResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOpportunityDto,
  ): Promise<OpportunityResponse> {
    return this.opportunitiesService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List opportunities I can access (brand team or collaborator)',
  })
  @ApiResponse({ status: 200, type: PaginatedOpportunitiesResponse })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOpportunitiesQueryDto,
  ): Promise<PaginatedOpportunitiesResponse> {
    return this.opportunitiesService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an opportunity with my capabilities' })
  @ApiResponse({ status: 200, type: OpportunityResponse })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    return this.opportunitiesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update title, summary or metadata (editor)' })
  @ApiResponse({ status: 200, type: OpportunityResponse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOpportunityDto,
  ): Promise<OpportunityResponse> {
    return this.opportunitiesService.update(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Archive (soft delete). Published versions are kept; share links stop resolving.',
  })
  @ApiResponse({ status: 200, type: OpportunityResponse })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    return this.opportunitiesService.archive(id, user);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived opportunity' })
  @ApiResponse({ status: 200, type: OpportunityResponse })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    return this.opportunitiesService.restore(id, user);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Activity feed' })
  @ApiResponse({ status: 200, type: PaginatedActivityResponse })
  activity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedActivityResponse> {
    return this.activityService.list(id, user, query);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List per-opportunity collaborators' })
  @ApiResponse({ status: 200, type: [OpportunityMemberResponse] })
  listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OpportunityMemberResponse[]> {
    return this.membersService.list(id, user);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a collaborator (brand admin or creator)' })
  @ApiResponse({ status: 201, type: OpportunityMemberResponse })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddOpportunityMemberDto,
  ): Promise<OpportunityMemberResponse> {
    return this.membersService.add(id, user, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a collaborator, or leave yourself' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.membersService.remove(id, memberUserId, user);
  }
}
