import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RbacService } from './services/rbac.service';
import { PermissionResponse, RoleResponse } from './types/admin-response.types';

@ApiTags('admin/rbac')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'List the fixed permission catalog' })
  @ApiResponse({ status: 200, type: [PermissionResponse] })
  listPermissions(): Promise<PermissionResponse[]> {
    return this.rbacService.listPermissions();
  }

  @Get('roles')
  @ApiOperation({ summary: 'List roles and their assigned permissions' })
  @ApiResponse({ status: 200, type: [RoleResponse] })
  listRoles(): Promise<RoleResponse[]> {
    return this.rbacService.listRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new custom role' })
  @ApiResponse({ status: 201, type: RoleResponse })
  createRole(@Body() dto: CreateRoleDto): Promise<RoleResponse> {
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id/permissions')
  @ApiOperation({ summary: "Replace a role's assigned permissions" })
  @ApiResponse({ status: 200, type: RoleResponse })
  setRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<RoleResponse> {
    return this.rbacService.setRolePermissions(id, dto);
  }
}
