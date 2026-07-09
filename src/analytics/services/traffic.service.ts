import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { AnalyticsSeriesQueryDto } from '../dto/analytics-series-query.dto';
import {
  TrafficSeriesPointResponse,
  TrafficSummaryResponse,
} from '../types/analytics-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { resolveDateRange } from '../utils/resolve-date-range.util';

@Injectable()
export class TrafficService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<TrafficSummaryResponse> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const where = {
      brandId: query.brandId,
      createdAt: { gte: from, lte: to },
    };

    const [totalViews, uniqueVisitorRows] = await Promise.all([
      this.prisma.pageView.count({ where }),
      this.prisma.pageView.findMany({
        where,
        distinct: ['visitorId'],
        select: { visitorId: true },
      }),
    ]);

    return {
      totalViews,
      uniqueVisitors: uniqueVisitorRows.length,
    };
  }

  async getSeries(
    query: AnalyticsSeriesQueryDto,
    user: AuthenticatedUser,
  ): Promise<TrafficSeriesPointResponse[]> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; views: number; uniquevisitors: number }[]
    >`
      SELECT date_trunc(${query.granularity}, "createdAt") as bucket,
             COUNT(*)::int as views,
             COUNT(DISTINCT "visitorId")::int as uniquevisitors
      FROM page_views
      WHERE "brandId" = ${query.brandId}
        AND "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return rows.map((row) => ({
      date: row.bucket,
      views: row.views,
      uniqueVisitors: row.uniquevisitors,
    }));
  }
}
