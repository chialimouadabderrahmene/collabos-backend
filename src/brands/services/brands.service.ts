import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { ListBrandsQueryDto } from '../dto/list-brands-query.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BrandWithRelations, toBrandResponse } from '../mappers/brand.mapper';
import {
  BrandResponse,
  MessageResponse,
  PaginatedBrandsResponse,
} from '../types/brand-response.types';
import { slugify, withUniqueSuffix } from '../utils/slug.util';

const BRAND_INCLUDE = { profile: true, categories: true } as const;

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateBrandDto): Promise<BrandResponse> {
    const slug = await this.generateUniqueSlug(dto.name);

    const brand = await this.prisma.brand.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        categories: dto.categoryIds
          ? { connect: dto.categoryIds.map((id) => ({ id })) }
          : undefined,
      },
      include: BRAND_INCLUDE,
    });

    return toBrandResponse(brand);
  }

  async findAll(query: ListBrandsQueryDto): Promise<PaginatedBrandsResponse> {
    const where: Prisma.BrandWhereInput = {
      isActive: true,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.category
        ? { categories: { some: { slug: query.category } } }
        : {}),
      ...(query.verifiedOnly ? { isVerified: true } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        include: BRAND_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      data: data.map((brand) => toBrandResponse(brand)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<BrandResponse> {
    const brand = await this.findEntityOrThrow(id);
    return toBrandResponse(brand);
  }

  async findBySlugOrThrow(slug: string): Promise<BrandResponse> {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: BRAND_INCLUDE,
    });

    if (!brand || !brand.isActive) {
      throw new NotFoundException('Brand not found');
    }

    return toBrandResponse(brand);
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateBrandDto,
  ): Promise<BrandResponse> {
    const existing = await this.findEntityOrThrow(id);
    this.assertOwnerOrAdmin(existing.ownerId, user);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: { name: dto.name },
      include: BRAND_INCLUDE,
    });

    return toBrandResponse(brand);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<MessageResponse> {
    const existing = await this.findEntityOrThrow(id);
    this.assertOwnerOrAdmin(existing.ownerId, user);

    await this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Brand deactivated' };
  }

  async assignCategories(
    id: string,
    user: AuthenticatedUser,
    categoryIds: string[],
  ): Promise<BrandResponse> {
    const existing = await this.findEntityOrThrow(id);
    this.assertOwnerOrAdmin(existing.ownerId, user);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        categories: {
          set: categoryIds.map((categoryId) => ({ id: categoryId })),
        },
      },
      include: BRAND_INCLUDE,
    });

    return toBrandResponse(brand);
  }

  async verify(id: string): Promise<BrandResponse> {
    await this.findEntityOrThrow(id);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date() },
      include: BRAND_INCLUDE,
    });

    return toBrandResponse(brand);
  }

  async unverify(id: string): Promise<BrandResponse> {
    await this.findEntityOrThrow(id);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isVerified: false, verifiedAt: null },
      include: BRAND_INCLUDE,
    });

    return toBrandResponse(brand);
  }

  assertOwnerOrAdmin(ownerId: string, user: AuthenticatedUser): void {
    const isOwner = ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this brand');
    }
  }

  async findEntityOrThrow(id: string): Promise<BrandWithRelations> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: BRAND_INCLUDE,
    });

    if (!brand || !brand.isActive) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.brand.findUnique({
      where: { slug: base },
    });

    if (!existing) {
      return base;
    }

    let candidate = withUniqueSuffix(base);
    while (await this.prisma.brand.findUnique({ where: { slug: candidate } })) {
      candidate = withUniqueSuffix(base);
    }

    return candidate;
  }
}
