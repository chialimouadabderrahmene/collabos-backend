import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { RevenuePredictionQueryDto } from '../dto/revenue-prediction-query.dto';
import { RevenuePredictionResponse } from '../types/ai-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { predictRevenue } from '../utils/revenue-prediction.util';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

function monthLabel(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

@Injectable()
export class RevenuePredictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly promptService: PromptService,
    private readonly configService: ConfigService,
  ) {}

  async getPrediction(
    brandId: string,
    query: RevenuePredictionQueryDto,
    user: AuthenticatedUser,
  ): Promise<RevenuePredictionResponse> {
    const brand = await assertBrandOwner(this.prisma, brandId, user);
    const ttl = this.configService.get<number>('ai.cacheTtlSeconds') ?? 900;

    const { value, cached } = await this.cacheService.getOrCompute(
      `revenue-prediction:${brandId}:${query.months}`,
      ttl,
      async () => {
        const rows = await this.prisma.$queryRaw<
          { bucket: Date; revenue: number }[]
        >`
          SELECT date_trunc('month', "createdAt") as bucket,
                 COALESCE(SUM(subtotal), 0)::int as revenue
          FROM orders
          WHERE "brandId" = ${brandId}
            AND status IN ('PAID', 'FULFILLED', 'COMPLETED', 'PARTIALLY_REFUNDED')
            AND "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY bucket
          ORDER BY bucket ASC
        `;

        const history = rows.map((row) => row.revenue);
        const { trend, predicted } = predictRevenue(history, query.months);

        const lastPeriod = rows.length
          ? rows[rows.length - 1].bucket
          : new Date();

        const predictedPoints = predicted.map((amount, index) => ({
          period: monthLabel(addMonths(lastPeriod, index + 1)),
          amount,
        }));

        const narrative = await this.promptService.revenuePredictionNarrative({
          brandName: brand.name,
          trend,
          predicted,
          currency: 'USD',
        });

        return {
          brandId,
          trend,
          history: rows.map((row) => ({
            period: monthLabel(row.bucket),
            amount: row.revenue,
          })),
          predicted: predictedPoints,
          currency: 'USD',
          narrative: narrative.text,
          generatedByAi: narrative.generatedByAi,
        };
      },
    );

    return { ...value, cached };
  }
}
