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
import { Roles } from '../auth/decorators/roles.decorator';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { AdminUsersService } from './services/admin-users.service';
import {
  AdminUserResponse,
  PaginatedAdminUsersResponse,
} from './types/admin-response.types';

@ApiTags('admin/users')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, type: PaginatedAdminUsersResponse })
  findAll(
    @Query() query: ListAdminUsersQueryDto,
  ): Promise<PaginatedAdminUsersResponse> {
    return this.adminUsersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user' })
  @ApiResponse({ status: 200, type: AdminUserResponse })
  findOne(@Param('id') id: string): Promise<AdminUserResponse> {
    return this.adminUsersService.findOneOrThrow(id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiResponse({ status: 200, type: AdminUserResponse })
  suspend(@Param('id') id: string): Promise<AdminUserResponse> {
    return this.adminUsersService.suspend(id);
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  @ApiResponse({ status: 200, type: AdminUserResponse })
  reactivate(@Param('id') id: string): Promise<AdminUserResponse> {
    return this.adminUsersService.reactivate(id);
  }

  @Patch(':id/roles')
  @ApiOperation({ summary: "Replace a user's roles" })
  @ApiResponse({ status: 200, type: AdminUserResponse })
  setRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
  ): Promise<AdminUserResponse> {
    return this.adminUsersService.setRoles(id, dto);
  }
}
