import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { REVENUE_ORDER_STATUSES } from '../constants/revenue-statuses.constant';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { AnalyticsSeriesQueryDto } from '../dto/analytics-series-query.dto';
import {
  RevenueSeriesPointResponse,
  RevenueSummaryResponse,
} from '../types/analytics-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { resolveDateRange } from '../utils/resolve-date-range.util';

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<RevenueSummaryResponse> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const where: Prisma.OrderWhereInput = {
      brandId: query.brandId,
      status: { in: REVENUE_ORDER_STATUSES },
      createdAt: { gte: from, lte: to },
    };

    const [aggregate, orderCount] = await Promise.all([
      this.prisma.order.aggregate({ where, _sum: { subtotal: true } }),
      this.prisma.order.count({ where }),
    ]);

    const totalRevenue = aggregate._sum.subtotal ?? 0;
    const averageOrderValue =
      orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0;

    return {
      totalRevenue,
      orderCount,
      averageOrderValue,
      currency: 'USD',
    };
  }

  async getSeries(
    query: AnalyticsSeriesQueryDto,
    user: AuthenticatedUser,
  ): Promise<RevenueSeriesPointResponse[]> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; revenue: number; orders: number }[]
    >`
      SELECT date_trunc(${query.granularity}, "createdAt") as bucket,
             COALESCE(SUM(subtotal), 0)::int as revenue,
             COUNT(*)::int as orders
      FROM orders
      WHERE "brandId" = ${query.brandId}
        AND status IN ('PAID', 'FULFILLED', 'COMPLETED', 'PARTIALLY_REFUNDED')
        AND "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return rows.map((row) => ({
      date: row.bucket,
      revenue: row.revenue,
      orders: row.orders,
    }));
  }
}
