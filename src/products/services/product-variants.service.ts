import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantDto } from '../dto/create-variant.dto';
import { UpdateVariantDto } from '../dto/update-variant.dto';
import { toVariantResponse } from '../mappers/product.mapper';
import {
  MessageResponse,
  VariantResponse,
} from '../types/product-response.types';
import { ProductsService } from './products.service';

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async create(
    productId: string,
    user: AuthenticatedUser,
    dto: CreateVariantDto,
  ): Promise<VariantResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);

    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: dto.sku,
          size: dto.size,
          color: dto.color,
          priceOverride: dto.priceOverride,
          stockQuantity: dto.stockQuantity ?? 0,
        },
      });

      return toVariantResponse(variant, product.price);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A variant with this SKU or size/color combination already exists',
        );
      }
      throw error;
    }
  }

  async findAll(
    productId: string,
    user?: AuthenticatedUser,
  ): Promise<VariantResponse[]> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertViewable(product, user);

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return variants.map((variant) => toVariantResponse(variant, product.price));
  }

  async update(
    productId: string,
    variantId: string,
    user: AuthenticatedUser,
    dto: UpdateVariantDto,
  ): Promise<VariantResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);
    await this.findOrThrow(productId, variantId);

    try {
      const updated = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          sku: dto.sku,
          size: dto.size,
          color: dto.color,
          priceOverride: dto.priceOverride,
        },
      });

      return toVariantResponse(updated, product.price);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A variant with this SKU or size/color combination already exists',
        );
      }
      throw error;
    }
  }

  async remove(
    productId: string,
    variantId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);
    await this.findOrThrow(productId, variantId);

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });

    return { message: 'Variant deactivated' };
  }

  async findVariantOrThrow(productId: string, variantId: string) {
    return this.findOrThrow(productId, variantId);
  }

  private async findOrThrow(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant || variant.productId !== productId) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }
}
