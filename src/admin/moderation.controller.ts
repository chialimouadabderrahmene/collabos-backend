import {
  Body,
  Controller,
  Get,
  Param,
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
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { FileReportDto } from './dto/file-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ModerationService } from './services/moderation.service';
import {
  ContentReportResponse,
  PaginatedContentReportsResponse,
} from './types/admin-response.types';

@ApiTags('admin/moderation')
@ApiBearerAuth()
@Controller('admin/moderation/reports')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @ApiOperation({ summary: 'File a content report' })
  @ApiResponse({ status: 201, type: ContentReportResponse })
  fileReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FileReportDto,
  ): Promise<ContentReportResponse> {
    return this.moderationService.fileReport(user, dto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List the moderation queue (admin only)' })
  @ApiResponse({ status: 200, type: PaginatedContentReportsResponse })
  listQueue(
    @Query() query: ListReportsQueryDto,
  ): Promise<PaginatedContentReportsResponse> {
    return this.moderationService.listQueue(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a content report (admin only)' })
  @ApiResponse({ status: 200, type: ContentReportResponse })
  findOne(@Param('id') id: string): Promise<ContentReportResponse> {
    return this.moderationService.findOneOrThrow(id);
  }

  @Patch(':id/review')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Review and resolve a content report (admin only)' })
  @ApiResponse({ status: 200, type: ContentReportResponse })
  review(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewReportDto,
  ): Promise<ContentReportResponse> {
    return this.moderationService.review(id, admin, dto);
  }
}
