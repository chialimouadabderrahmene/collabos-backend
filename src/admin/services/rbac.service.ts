import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import { toPermissionResponse, toRoleResponse } from '../mappers/admin.mapper';
import {
  PermissionResponse,
  RoleResponse,
} from '../types/admin-response.types';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions(): Promise<PermissionResponse[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
    return permissions.map(toPermissionResponse);
  }

  async listRoles(): Promise<RoleResponse[]> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    return roles.map(toRoleResponse);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleResponse> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(`Role "${dto.name}" already exists`);
    }

    const role = await this.prisma.role.create({
      data: { name: dto.name },
      include: { permissions: true },
    });

    return toRoleResponse(role);
  }

  async setRolePermissions(
    id: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<RoleResponse> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new BadRequestException(`Role with id "${id}" not found`);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: dto.permissions } },
    });

    if (permissions.length !== dto.permissions.length) {
      const found = new Set(permissions.map((permission) => permission.name));
      const missing = dto.permissions.filter((name) => !found.has(name));
      throw new BadRequestException(
        `Unknown permission(s): ${missing.join(', ')}`,
      );
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        permissions: {
          set: permissions.map((permission) => ({ id: permission.id })),
        },
      },
      include: { permissions: true },
    });

    return toRoleResponse(updated);
  }
}
