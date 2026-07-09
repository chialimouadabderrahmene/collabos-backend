import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { toUserResponse } from '../mappers/user.mapper';
import {
  PaginatedUsersResponse,
  UserResponse,
} from '../types/user-response.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto): Promise<PaginatedUsersResponse> {
    const where: Prisma.UserWhereInput = query.search
      ? { email: { contains: query.search, mode: 'insensitive' } }
      : {};

    const [data, total] = await this.prisma.$transaction([
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
      data: data.map((user) => toUserResponse(user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserResponse(user);
  }

  async update(id: string, dto: AdminUpdateUserDto): Promise<UserResponse> {
    await this.ensureExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      include: { roles: true },
    });

    return toUserResponse(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.ensureExists(id);

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'User deactivated' };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}
