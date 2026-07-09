import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductMediaDto } from '../dto/create-product-media.dto';
import { toProductMediaResponse } from '../mappers/product.mapper';
import {
  MessageResponse,
  ProductMediaResponse,
} from '../types/product-response.types';
import { ProductMediaStorageService } from './product-media-storage.service';
import { ProductsService } from './products.service';

@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly mediaStorage: ProductMediaStorageService,
  ) {}

  async add(
    productId: string,
    user: AuthenticatedUser,
    dto: CreateProductMediaDto,
    file: Express.Multer.File | undefined,
  ): Promise<ProductMediaResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);

    if (!file) {
      throw new BadRequestException('A media file is required');
    }

    if (file.size > this.mediaStorage.getMaxSizeBytes()) {
      throw new PayloadTooLargeException(
        `Media must be smaller than ${this.mediaStorage.getMaxSizeBytes() / (1024 * 1024)}MB`,
      );
    }

    const url = await this.mediaStorage.save(file);

    const media = await this.prisma.productMedia.create({
      data: {
        productId,
        url,
        altText: dto.altText,
        position: dto.position ?? 0,
      },
    });

    return toProductMediaResponse(media);
  }

  async findAll(
    productId: string,
    user?: AuthenticatedUser,
  ): Promise<ProductMediaResponse[]> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertViewable(product, user);

    const media = await this.prisma.productMedia.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
    });

    return media.map((item) => toProductMediaResponse(item));
  }

  async remove(
    productId: string,
    mediaId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const product = await this.productsService.findEntityOrThrow(productId);
    await this.productsService.assertOwnerOrAdmin(product, user);

    const media = await this.prisma.productMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.productId !== productId) {
      throw new NotFoundException('Media not found');
    }

    await this.mediaStorage.delete(media.url);
    await this.prisma.productMedia.delete({ where: { id: mediaId } });

    return { message: 'Media removed' };
  }
}
