import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDropProductDto } from '../dto/create-drop-product.dto';
import { UpdateDropProductDto } from '../dto/update-drop-product.dto';
import { toDropProductResponse } from '../mappers/drop.mapper';
import {
  DropProductResponse,
  MessageResponse,
} from '../types/drop-response.types';
import { DropsService } from './drops.service';

@Injectable()
export class DropProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dropsService: DropsService,
  ) {}

  async create(
    dropId: string,
    user: AuthenticatedUser,
    dto: CreateDropProductDto,
  ): Promise<DropProductResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    const product = await this.prisma.dropProduct.create({
      data: {
        dropId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        sku: dto.sku,
        stockQuantity: dto.stockQuantity,
        imageUrl: dto.imageUrl,
        position: dto.position ?? 0,
        isAvailable: dto.isAvailable ?? true,
      },
    });

    return toDropProductResponse(product);
  }

  async findAll(
    dropId: string,
    user?: AuthenticatedUser,
  ): Promise<DropProductResponse[]> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertViewable(drop, user);

    const products = await this.prisma.dropProduct.findMany({
      where: { dropId },
      orderBy: { position: 'asc' },
    });

    return products.map((product) => toDropProductResponse(product));
  }

  async update(
    dropId: string,
    productId: string,
    user: AuthenticatedUser,
    dto: UpdateDropProductDto,
  ): Promise<DropProductResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    await this.findOrThrow(dropId, productId);

    const updated = await this.prisma.dropProduct.update({
      where: { id: productId },
      data: dto,
    });

    return toDropProductResponse(updated);
  }

  async remove(
    dropId: string,
    productId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    await this.findOrThrow(dropId, productId);
    await this.prisma.dropProduct.delete({ where: { id: productId } });

    return { message: 'Product removed' };
  }

  private async findOrThrow(dropId: string, productId: string) {
    const product = await this.prisma.dropProduct.findUnique({
      where: { id: productId },
    });

    if (!product || product.dropId !== dropId) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
