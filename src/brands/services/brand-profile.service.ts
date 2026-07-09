import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBrandProfileDto } from '../dto/update-brand-profile.dto';
import { BrandProfileResponse } from '../types/brand-response.types';
import { BrandsService } from './brands.service';

@Injectable()
export class BrandProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandsService: BrandsService,
  ) {}

  async getProfile(brandId: string): Promise<BrandProfileResponse> {
    return this.prisma.brandProfile.upsert({
      where: { brandId },
      update: {},
      create: { brandId },
    });
  }

  async updateProfile(
    brandId: string,
    user: AuthenticatedUser,
    dto: UpdateBrandProfileDto,
  ): Promise<BrandProfileResponse> {
    const brand = await this.brandsService.findEntityOrThrow(brandId);
    this.brandsService.assertOwnerOrAdmin(brand.ownerId, user);

    return this.prisma.brandProfile.upsert({
      where: { brandId },
      update: dto,
      create: { brandId, ...dto },
    });
  }
}
