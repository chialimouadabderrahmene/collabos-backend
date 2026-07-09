import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminBrandsQueryDto } from '../dto/list-admin-brands-query.dto';
import { toAdminBrandResponse } from '../mappers/admin.mapper';
import {
  AdminBrandResponse,
  PaginatedAdminBrandsResponse,
} from '../types/admin-response.types';

@Injectable()
export class AdminBrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListAdminBrandsQueryDto,
  ): Promise<PaginatedAdminBrandsResponse> {
    const where: Prisma.BrandWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isVerified !== undefined
        ? { isVerified: query.isVerified }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [brands, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      data: brands.map((brand) => toAdminBrandResponse(brand)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<AdminBrandResponse> {
    const brand = await this.getEntityOrThrow(id);
    return toAdminBrandResponse(brand);
  }

  async verify(id: string): Promise<AdminBrandResponse> {
    await this.getEntityOrThrow(id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date() },
    });
    return toAdminBrandResponse(brand);
  }

  async unverify(id: string): Promise<AdminBrandResponse> {
    await this.getEntityOrThrow(id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isVerified: false, verifiedAt: null },
    });
    return toAdminBrandResponse(brand);
  }

  async activate(id: string): Promise<AdminBrandResponse> {
    await this.getEntityOrThrow(id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isActive: true },
    });
    return toAdminBrandResponse(brand);
  }

  async deactivate(id: string): Promise<AdminBrandResponse> {
    await this.getEntityOrThrow(id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });
    return toAdminBrandResponse(brand);
  }

  private async getEntityOrThrow(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }
}
