import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { ApplicationsService } from './services/applications.service';
import {
  ApplicationResponse,
  PaginatedApplicationsResponse,
} from './types/application-response.types';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Apply to a brief' })
  @ApiResponse({ status: 201, type: ApplicationResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    return this.applicationsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my own applications' })
  @ApiResponse({ status: 200, type: PaginatedApplicationsResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponse> {
    return this.applicationsService.findMyApplications(user.id, query);
  }

  @Get('brief/:briefId')
  @ApiOperation({
    summary: 'List applications received for a brief (brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: PaginatedApplicationsResponse })
  findForBrief(
    @Param('briefId') briefId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponse> {
    return this.applicationsService.findBriefApplications(briefId, user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an application (applicant, brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: ApplicationResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.applicationsService.findOneOrThrow(id, user);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw a pending application (applicant only)' })
  @ApiResponse({ status: 200, type: ApplicationResponse })
  withdraw(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.applicationsService.withdraw(id, user);
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: 'Accept a pending application (brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: ApplicationResponse })
  accept(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.applicationsService.accept(id, user);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending application (brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: ApplicationResponse })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.applicationsService.reject(id, user);
  }
}
