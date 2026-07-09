import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';
import { AuditService } from './services/audit.service';
import { PaginatedAuditLogsResponse } from './types/admin-response.types';

@ApiTags('admin/audit')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries' })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsResponse })
  findAll(
    @Query() query: ListAuditQueryDto,
  ): Promise<PaginatedAuditLogsResponse> {
    return this.auditService.findAll(query);
  }
}
