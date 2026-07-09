import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CancelDealDto } from './dto/cancel-deal.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateResponsibilityDto } from './dto/create-responsibility.dto';
import { ListDealsQueryDto } from './dto/list-deals-query.dto';
import { DealHealthService } from './services/deal-health.service';
import { DealsService } from './services/deals.service';
import { MilestonesService } from './services/milestones.service';
import { ProposalsService } from './services/proposals.service';
import { ResponsibilitiesService } from './services/responsibilities.service';
import {
  DealHealthResponse,
  DealResponse,
  MessageResponse,
  MilestoneResponse,
  PaginatedDealsResponse,
  ProposalResponse,
  ResponsibilityResponse,
} from './types/deal-response.types';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly proposalsService: ProposalsService,
    private readonly responsibilitiesService: ResponsibilitiesService,
    private readonly milestonesService: MilestonesService,
    private readonly dealHealthService: DealHealthService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a deal from an accepted application (brand owner or admin)',
  })
  @ApiResponse({ status: 201, type: DealResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDealDto,
  ): Promise<DealResponse> {
    return this.dealsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my deals (as brand owner or creator)' })
  @ApiResponse({ status: 200, type: PaginatedDealsResponse })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDealsQueryDto,
  ): Promise<PaginatedDealsResponse> {
    return this.dealsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a deal' })
  @ApiResponse({ status: 200, type: DealResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    return this.dealsService.findOneOrThrow(id, user);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark an active deal as completed' })
  @ApiResponse({ status: 200, type: DealResponse })
  complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealResponse> {
    return this.dealsService.complete(id, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a deal' })
  @ApiResponse({ status: 200, type: DealResponse })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelDealDto,
  ): Promise<DealResponse> {
    return this.dealsService.cancel(id, user, dto);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get the computed health of a deal' })
  @ApiResponse({ status: 200, type: DealHealthResponse })
  getHealth(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DealHealthResponse> {
    return this.dealHealthService.getHealth(id, user);
  }

  @Post(':id/proposals')
  @ApiOperation({ summary: 'Submit a counter-proposal while negotiating' })
  @ApiResponse({ status: 201, type: ProposalResponse })
  createProposal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalResponse> {
    return this.proposalsService.create(id, user, dto);
  }

  @Get(':id/proposals')
  @ApiOperation({ summary: 'List the negotiation history for a deal' })
  @ApiResponse({ status: 200, type: [ProposalResponse] })
  findProposals(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalResponse[]> {
    return this.proposalsService.findAll(id, user);
  }

  @Post(':id/proposals/:proposalId/accept')
  @ApiOperation({ summary: 'Accept a pending proposal (activates the deal)' })
  @ApiResponse({ status: 200, type: ProposalResponse })
  acceptProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalResponse> {
    return this.proposalsService.accept(id, proposalId, user);
  }

  @Post(':id/proposals/:proposalId/reject')
  @ApiOperation({ summary: 'Reject a pending proposal' })
  @ApiResponse({ status: 200, type: ProposalResponse })
  rejectProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalResponse> {
    return this.proposalsService.reject(id, proposalId, user);
  }

  @Post(':id/responsibilities')
  @ApiOperation({ summary: 'Add a responsibility to a deal' })
  @ApiResponse({ status: 201, type: ResponsibilityResponse })
  createResponsibility(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateResponsibilityDto,
  ): Promise<ResponsibilityResponse> {
    return this.responsibilitiesService.create(id, user, dto);
  }

  @Get(':id/responsibilities')
  @ApiOperation({ summary: 'List a deal responsibilities' })
  @ApiResponse({ status: 200, type: [ResponsibilityResponse] })
  findResponsibilities(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponsibilityResponse[]> {
    return this.responsibilitiesService.findAll(id, user);
  }

  @Post(':id/responsibilities/:responsibilityId/complete')
  @ApiOperation({ summary: 'Mark a responsibility as completed' })
  @ApiResponse({ status: 200, type: ResponsibilityResponse })
  completeResponsibility(
    @Param('id') id: string,
    @Param('responsibilityId') responsibilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponsibilityResponse> {
    return this.responsibilitiesService.complete(id, responsibilityId, user);
  }

  @Delete(':id/responsibilities/:responsibilityId')
  @ApiOperation({ summary: 'Remove a responsibility' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeResponsibility(
    @Param('id') id: string,
    @Param('responsibilityId') responsibilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.responsibilitiesService.remove(id, responsibilityId, user);
  }

  @Post(':id/milestones')
  @ApiOperation({ summary: 'Add a timeline milestone to a deal' })
  @ApiResponse({ status: 201, type: MilestoneResponse })
  createMilestone(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMilestoneDto,
  ): Promise<MilestoneResponse> {
    return this.milestonesService.create(id, user, dto);
  }

  @Get(':id/milestones')
  @ApiOperation({ summary: 'List a deal timeline' })
  @ApiResponse({ status: 200, type: [MilestoneResponse] })
  findMilestones(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneResponse[]> {
    return this.milestonesService.findAll(id, user);
  }

  @Post(':id/milestones/:milestoneId/complete')
  @ApiOperation({ summary: 'Mark a milestone as completed' })
  @ApiResponse({ status: 200, type: MilestoneResponse })
  completeMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneResponse> {
    return this.milestonesService.complete(id, milestoneId, user);
  }

  @Delete(':id/milestones/:milestoneId')
  @ApiOperation({ summary: 'Remove a milestone' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.milestonesService.remove(id, milestoneId, user);
  }
}
