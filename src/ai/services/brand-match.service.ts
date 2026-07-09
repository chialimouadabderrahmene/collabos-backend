import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DealStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandMatchResponse } from '../types/ai-response.types';
import { computeBrandMatchScore } from '../utils/brand-match-score.util';
import { findPriorBrandIdsForCreator } from '../utils/prior-brands.util';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

@Injectable()
export class BrandMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly configService: ConfigService,
  ) {}

  async getMatch(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<BrandMatchResponse> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { categories: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const creatorId = user.id;
    const ttl = this.configService.get<number>('ai.cacheTtlSeconds') ?? 900;

    const { value, cached } = await this.cacheService.getOrCompute(
      `brand-match:${brandId}:${creatorId}`,
      ttl,
      async () => {
        const priorBrandIds = await findPriorBrandIdsForCreator(
          this.prisma,
          creatorId,
        );
        const priorBrands = priorBrandIds.length
          ? await this.prisma.brand.findMany({
              where: { id: { in: priorBrandIds } },
              include: { categories: true },
            })
          : [];

        const creatorCategoryIds = new Set(
          priorBrands.flatMap((priorBrand) =>
            priorBrand.categories.map((category) => category.id),
          ),
        );

        const overlapCategories = brand.categories.filter((category) =>
          creatorCategoryIds.has(category.id),
        );

        const completedDealsCount = await this.prisma.deal.count({
          where: { creatorId, status: DealStatus.COMPLETED },
        });

        const score = computeBrandMatchScore({
          targetCategoryCount: brand.categories.length,
          overlapCategoryCount: overlapCategories.length,
          completedDealsCount,
        });

        const narrative = await this.promptService.brandMatchNarrative({
          brandName: brand.name,
          score,
          overlapCategories: overlapCategories.map((category) => category.name),
        });

        return {
          brandId,
          creatorId,
          score,
          overlapCategories: overlapCategories.map((category) => category.name),
          narrative: narrative.text,
          generatedByAi: narrative.generatedByAi,
        };
      },
    );

    return { ...value, cached };
  }
}
