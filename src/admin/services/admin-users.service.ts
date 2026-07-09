import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminUsersQueryDto } from '../dto/list-admin-users-query.dto';
import { UpdateUserRolesDto } from '../dto/update-user-roles.dto';
import { toAdminUserResponse } from '../mappers/admin.mapper';
import {
  AdminUserResponse,
  PaginatedAdminUsersResponse,
} from '../types/admin-response.types';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListAdminUsersQueryDto,
  ): Promise<PaginatedAdminUsersResponse> {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.role ? { roles: { some: { name: query.role } } } : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { roles: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => toAdminUserResponse(user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<AdminUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toAdminUserResponse(user);
  }

  async suspend(id: string): Promise<AdminUserResponse> {
    await this.findOneOrThrow(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { roles: true },
    });

    return toAdminUserResponse(user);
  }

  async reactivate(id: string): Promise<AdminUserResponse> {
    await this.findOneOrThrow(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: { roles: true },
    });

    return toAdminUserResponse(user);
  }

  async setRoles(
    id: string,
    dto: UpdateUserRolesDto,
  ): Promise<AdminUserResponse> {
    await this.findOneOrThrow(id);

    const roles = await this.prisma.role.findMany({
      where: { name: { in: dto.roles } },
    });

    if (roles.length !== dto.roles.length) {
      const foundNames = new Set(roles.map((role) => role.name));
      const missing = dto.roles.filter((name) => !foundNames.has(name));
      throw new BadRequestException(`Unknown role(s): ${missing.join(', ')}`);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { roles: { set: roles.map((role) => ({ id: role.id })) } },
      include: { roles: true },
    });

    return toAdminUserResponse(user);
  }
}
