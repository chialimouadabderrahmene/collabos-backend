import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CoverResponse, LogoResponse } from '../types/brand-response.types';
import { BrandAssetStorageService } from './brand-asset-storage.service';
import { BrandsService } from './brands.service';

@Injectable()
export class BrandAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandsService: BrandsService,
    private readonly assetStorage: BrandAssetStorageService,
  ) {}

  async setLogo(
    brandId: string,
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<LogoResponse> {
    const brand = await this.validateAndAuthorize(brandId, user, file, 'logo');

    const logoUrl = await this.assetStorage.save(brandId, 'logo', file!);
    await this.assetStorage.delete(brand.logoUrl);

    await this.prisma.brand.update({
      where: { id: brandId },
      data: { logoUrl },
    });

    return { logoUrl };
  }

  async removeLogo(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<LogoResponse> {
    const brand = await this.brandsService.findEntityOrThrow(brandId);
    this.brandsService.assertOwnerOrAdmin(brand.ownerId, user);

    await this.assetStorage.delete(brand.logoUrl);
    await this.prisma.brand.update({
      where: { id: brandId },
      data: { logoUrl: null },
    });

    return { logoUrl: null };
  }

  async setCover(
    brandId: string,
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<CoverResponse> {
    const brand = await this.validateAndAuthorize(brandId, user, file, 'cover');

    const coverUrl = await this.assetStorage.save(brandId, 'cover', file!);
    await this.assetStorage.delete(brand.coverUrl);

    await this.prisma.brand.update({
      where: { id: brandId },
      data: { coverUrl },
    });

    return { coverUrl };
  }

  async removeCover(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<CoverResponse> {
    const brand = await this.brandsService.findEntityOrThrow(brandId);
    this.brandsService.assertOwnerOrAdmin(brand.ownerId, user);

    await this.assetStorage.delete(brand.coverUrl);
    await this.prisma.brand.update({
      where: { id: brandId },
      data: { coverUrl: null },
    });

    return { coverUrl: null };
  }

  private async validateAndAuthorize(
    brandId: string,
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    kind: 'logo' | 'cover',
  ) {
    const brand = await this.brandsService.findEntityOrThrow(brandId);
    this.brandsService.assertOwnerOrAdmin(brand.ownerId, user);

    if (!file) {
      throw new BadRequestException(`${kind} file is required`);
    }

    const maxSize = this.assetStorage.getMaxSizeBytes(kind);
    if (file.size > maxSize) {
      throw new PayloadTooLargeException(
        `${kind} must be smaller than ${maxSize / (1024 * 1024)}MB`,
      );
    }

    return brand;
  }
}
