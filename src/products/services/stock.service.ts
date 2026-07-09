import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { ListStockMovementsQueryDto } from '../dto/list-stock-movements-query.dto';
import {
  toStockMovementResponse,
  toVariantResponse,
} from '../mappers/product.mapper';
import { PaginatedStockMovementsResponse } from '../types/paginated-stock-movements-response.type';
import { VariantResponse } from '../types/product-response.types';
import { ProductVariantsService } from './product-variants.service';
import { ProductsService } from './products.service';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly variantsService: ProductVariantsService,
  ) {}

  async adjust(
    productId: string,
    variantId: string,
    user: AuthenticatedUser,
    dto: AdjustStockDto,
  ): Promise<VariantResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);

    const variant = await this.variantsService.findVariantOrThrow(
      productId,
      variantId,
    );

    const newStock = variant.stockQuantity + dto.quantity;
    if (newStock < 0) {
      throw new BadRequestException(
        'This adjustment would result in negative stock',
      );
    }

    const [, updatedVariant] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          variantId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      }),
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStock },
      }),
    ]);

    return toVariantResponse(updatedVariant, product.price);
  }

  async findMovements(
    productId: string,
    variantId: string,
    user: AuthenticatedUser,
    query: ListStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementsResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);
    await this.variantsService.findVariantOrThrow(productId, variantId);

    const where = { variantId };

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements.map((movement) => toStockMovementResponse(movement)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
