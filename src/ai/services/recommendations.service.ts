import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BriefStatus, DealStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsQueryDto } from '../dto/recommendations-query.dto';
import { RecommendationsResponse } from '../types/ai-response.types';
import { computeBrandMatchScore } from '../utils/brand-match-score.util';
import { findPriorBrandIdsForCreator } from '../utils/prior-brands.util';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

const CANDIDATE_POOL_SIZE = 50;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly configService: ConfigService,
  ) {}

  async getRecommendations(
    user: AuthenticatedUser,
    query: RecommendationsQueryDto,
  ): Promise<RecommendationsResponse> {
    const ttl = this.configService.get<number>('ai.cacheTtlSeconds') ?? 900;

    const { value, cached } = await this.cacheService.getOrCompute(
      `recommendations:${user.id}:${query.limit}`,
      ttl,
      async () => {
        const [priorBrandIds, appliedBriefIds, completedDealsCount] =
          await Promise.all([
            findPriorBrandIdsForCreator(this.prisma, user.id),
            this.prisma.application
              .findMany({
                where: { applicantId: user.id },
                select: { briefId: true },
              })
              .then((rows) => new Set(rows.map((row) => row.briefId))),
            this.prisma.deal.count({
              where: { creatorId: user.id, status: DealStatus.COMPLETED },
            }),
          ]);

        const priorBrands = priorBrandIds.length
          ? await this.prisma.brand.findMany({
              where: { id: { in: priorBrandIds } },
              include: { categories: true },
            })
          : [];

        const creatorCategoryIds = new Set(
          priorBrands.flatMap((brand) =>
            brand.categories.map((category) => category.id),
          ),
        );

        const candidates = await this.prisma.brief.findMany({
          where: { status: BriefStatus.OPEN },
          include: { brand: { include: { categories: true } } },
          orderBy: { createdAt: 'desc' },
          take: CANDIDATE_POOL_SIZE,
        });

        const scored = candidates
          .filter((brief) => !appliedBriefIds.has(brief.id))
          .map((brief) => {
            const overlapCategories = brief.brand.categories.filter(
              (category) => creatorCategoryIds.has(category.id),
            );

            const score = computeBrandMatchScore({
              targetCategoryCount: brief.brand.categories.length,
              overlapCategoryCount: overlapCategories.length,
              completedDealsCount,
            });

            return { brief, overlapCategories, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, query.limit);

        const data = await Promise.all(
          scored.map(async ({ brief, overlapCategories, score }) => {
            const overlapCategoryNames = overlapCategories.map(
              (category) => category.name,
            );

            const reason = await this.promptService.recommendationReason({
              briefTitle: brief.title,
              brandName: brief.brand.name,
              score,
              overlapCategories: overlapCategoryNames,
            });

            return {
              briefId: brief.id,
              brandId: brief.brandId,
              brandName: brief.brand.name,
              briefTitle: brief.title,
              score,
              overlapCategories: overlapCategoryNames,
              reason: reason.text,
              generatedByAi: reason.generatedByAi,
            };
          }),
        );

        return { data };
      },
    );

    return { ...value, cached };
  }
}
