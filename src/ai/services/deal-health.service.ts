import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { DealHealthResponse } from '../types/ai-response.types';
import { assertDealParticipant } from '../utils/assert-deal-participant.util';
import { computeDealHealthScore } from '../utils/deal-health-score.util';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

@Injectable()
export class DealHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly configService: ConfigService,
  ) {}

  async getHealth(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<DealHealthResponse> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { brand: true, milestones: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    assertDealParticipant(deal, user);

    const ttl = this.configService.get<number>('ai.cacheTtlSeconds') ?? 900;

    const { value, cached } = await this.cacheService.getOrCompute(
      `deal-health:${dealId}`,
      ttl,
      async () => {
        const { score, riskFactors } = computeDealHealthScore({
          status: deal.status,
          endDate: deal.endDate,
          milestones: deal.milestones.map((milestone) => ({
            dueDate: milestone.dueDate,
            isCompleted: milestone.isCompleted,
          })),
        });

        const narrative = await this.promptService.dealHealthNarrative({
          dealTitle: deal.title,
          score,
          riskFactors,
        });

        return {
          dealId,
          score,
          riskFactors,
          narrative: narrative.text,
          generatedByAi: narrative.generatedByAi,
        };
      },
    );

    return { ...value, cached };
  }
}
