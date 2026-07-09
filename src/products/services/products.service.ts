import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, Product, ProductVariant } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ListProductsQueryDto } from '../dto/list-products-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { toProductResponse } from '../mappers/product.mapper';
import {
  MessageResponse,
  PaginatedProductsResponse,
  ProductResponse,
} from '../types/product-response.types';
import { slugify, withUniqueSuffix } from '../utils/slug.util';

const PRODUCT_INCLUDE = { categories: true, variants: true } as const;

type ProductWithRelations = Product & {
  categories: Category[];
  variants: ProductVariant[];
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    await this.assertBrandOwnerOrAdmin(dto.brandId, user);

    const slug = await this.generateUniqueSlug(dto.name);

    const product = await this.prisma.product.create({
      data: {
        brandId: dto.brandId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        currency: dto.currency ?? 'USD',
        slug,
        categories: dto.categoryIds
          ? { connect: dto.categoryIds.map((id) => ({ id })) }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    return toProductResponse(product);
  }

  async findAll(
    query: ListProductsQueryDto,
  ): Promise<PaginatedProductsResponse> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.category
        ? { categories: { some: { slug: query.category } } }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => toProductResponse(product)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<ProductResponse> {
    const product = await this.findEntityOrThrow(id);
    await this.assertViewable(product, user);

    return toProductResponse(product);
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const product = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(product, user);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        currency: dto.currency,
      },
      include: PRODUCT_INCLUDE,
    });

    return toProductResponse(updated);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<MessageResponse> {
    const product = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(product, user);

    if (!product.isActive) {
      throw new ConflictException('This product is already inactive');
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Product deactivated' };
  }

  async assignCategories(
    id: string,
    user: AuthenticatedUser,
    categoryIds: string[],
  ): Promise<ProductResponse> {
    const product = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(product, user);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        categories: {
          set: categoryIds.map((categoryId) => ({ id: categoryId })),
        },
      },
      include: PRODUCT_INCLUDE,
    });

    return toProductResponse(updated);
  }

  async findEntityOrThrow(id: string): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async assertOwnerOrAdmin(
    product: Product,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.assertBrandOwnerOrAdmin(product.brandId, user);
  }

  async assertViewable(
    product: Product,
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (product.isActive) {
      return;
    }

    if (!user) {
      throw new NotFoundException('Product not found');
    }

    await this.assertOwnerOrAdmin(product, user);
  }

  private async assertBrandOwnerOrAdmin(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand || !brand.isActive) {
      throw new NotFoundException('Brand not found');
    }

    const isOwner = brand.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this brand');
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.product.findUnique({
      where: { slug: base },
    });

    if (!existing) {
      return base;
    }

    let candidate = withUniqueSuffix(base);
    while (
      await this.prisma.product.findUnique({ where: { slug: candidate } })
    ) {
      candidate = withUniqueSuffix(base);
    }

    return candidate;
  }
}
