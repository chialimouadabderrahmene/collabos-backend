import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListFollowersQueryDto } from '../dto/list-followers-query.dto';
import {
  FollowResponse,
  PaginatedFollowersResponse,
} from '../types/brand-response.types';
import { BrandsService } from './brands.service';

@Injectable()
export class FollowersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandsService: BrandsService,
  ) {}

  async follow(brandId: string, userId: string): Promise<FollowResponse> {
    await this.brandsService.findEntityOrThrow(brandId);

    const existing = await this.prisma.brandFollower.findUnique({
      where: { brandId_userId: { brandId, userId } },
    });

    if (existing) {
      const brand = await this.brandsService.findEntityOrThrow(brandId);
      return { following: true, followersCount: brand.followersCount };
    }

    const [, brand] = await this.prisma.$transaction([
      this.prisma.brandFollower.create({ data: { brandId, userId } }),
      this.prisma.brand.update({
        where: { id: brandId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    return { following: true, followersCount: brand.followersCount };
  }

  async unfollow(brandId: string, userId: string): Promise<FollowResponse> {
    await this.brandsService.findEntityOrThrow(brandId);

    const existing = await this.prisma.brandFollower.findUnique({
      where: { brandId_userId: { brandId, userId } },
    });

    if (!existing) {
      const brand = await this.brandsService.findEntityOrThrow(brandId);
      return { following: false, followersCount: brand.followersCount };
    }

    const [, brand] = await this.prisma.$transaction([
      this.prisma.brandFollower.delete({ where: { id: existing.id } }),
      this.prisma.brand.update({
        where: { id: brandId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    return { following: false, followersCount: brand.followersCount };
  }

  async listFollowers(
    brandId: string,
    query: ListFollowersQueryDto,
  ): Promise<PaginatedFollowersResponse> {
    await this.brandsService.findEntityOrThrow(brandId);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.brandFollower.findMany({
        where: { brandId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brandFollower.count({ where: { brandId } }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
