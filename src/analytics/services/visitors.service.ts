import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { VisitorsSummaryResponse } from '../types/analytics-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { resolveDateRange } from '../utils/resolve-date-range.util';

const TOP_PAGES_LIMIT = 10;

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<VisitorsSummaryResponse> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const where = {
      brandId: query.brandId,
      createdAt: { gte: from, lte: to },
    };

    const [totalViews, uniqueVisitorRows, pageGroups] = await Promise.all([
      this.prisma.pageView.count({ where }),
      this.prisma.pageView.findMany({
        where,
        distinct: ['visitorId'],
        select: { visitorId: true },
      }),
      this.prisma.pageView.groupBy({
        by: ['targetType', 'targetId'],
        where,
        _count: true,
      }),
    ]);

    const uniqueVisitors = uniqueVisitorRows.length;
    const averageViewsPerVisitor =
      uniqueVisitors > 0
        ? Math.round((totalViews / uniqueVisitors) * 100) / 100
        : 0;

    const topPages = pageGroups
      .map((group) => ({
        targetType: group.targetType,
        targetId: group.targetId,
        views: group._count,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, TOP_PAGES_LIMIT);

    return {
      totalViews,
      uniqueVisitors,
      averageViewsPerVisitor,
      topPages,
    };
  }
}
