import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { REVENUE_ORDER_STATUSES } from '../constants/revenue-statuses.constant';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { ConversionResponse } from '../types/analytics-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { resolveDateRange } from '../utils/resolve-date-range.util';

@Injectable()
export class ConversionService {
  constructor(private readonly prisma: PrismaService) {}

  async getConversion(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<ConversionResponse> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const [uniqueVisitorRows, orders] = await Promise.all([
      this.prisma.pageView.findMany({
        where: { brandId: query.brandId, createdAt: { gte: from, lte: to } },
        distinct: ['visitorId'],
        select: { visitorId: true },
      }),
      this.prisma.order.count({
        where: {
          brandId: query.brandId,
          status: { in: REVENUE_ORDER_STATUSES },
          createdAt: { gte: from, lte: to },
        },
      }),
    ]);

    const uniqueVisitors = uniqueVisitorRows.length;
    const conversionRate =
      uniqueVisitors > 0
        ? Math.round((orders / uniqueVisitors) * 10000) / 10000
        : 0;

    return { uniqueVisitors, orders, conversionRate };
  }
}
