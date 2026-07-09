import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GrowthReportQueryDto } from '../dto/growth-report-query.dto';
import { GrowthReportResponse } from '../types/admin-response.types';
import { resolveDateRange } from '../utils/resolve-date-range.util';

interface DailyCount {
  bucket: Date;
  count: number;
}

interface DailyRevenue {
  bucket: Date;
  revenue: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGrowthReport(
    query: GrowthReportQueryDto,
  ): Promise<GrowthReportResponse> {
    const { from, to } = resolveDateRange(query);

    const [
      totalNewUsers,
      totalNewBrands,
      totalNewOrders,
      revenueAggregate,
      userSeries,
      brandSeries,
      orderSeries,
      revenueSeries,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.brand.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: {
            in: ['PAID', 'FULFILLED', 'COMPLETED', 'PARTIALLY_REFUNDED'],
          },
        },
        _sum: { subtotal: true },
      }),
      this.prisma.$queryRaw<DailyCount[]>`
        SELECT date_trunc('day', "createdAt") as bucket, COUNT(*)::int as count
        FROM users
        WHERE "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      this.prisma.$queryRaw<DailyCount[]>`
        SELECT date_trunc('day', "createdAt") as bucket, COUNT(*)::int as count
        FROM brands
        WHERE "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      this.prisma.$queryRaw<DailyCount[]>`
        SELECT date_trunc('day', "createdAt") as bucket, COUNT(*)::int as count
        FROM orders
        WHERE "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      this.prisma.$queryRaw<DailyRevenue[]>`
        SELECT date_trunc('day', "createdAt") as bucket, COALESCE(SUM(subtotal), 0)::int as revenue
        FROM orders
        WHERE "createdAt" BETWEEN ${from} AND ${to}
          AND status IN ('PAID', 'FULFILLED', 'COMPLETED', 'PARTIALLY_REFUNDED')
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ]);

    const series = this.mergeSeries(
      userSeries,
      brandSeries,
      orderSeries,
      revenueSeries,
    );

    return {
      periodFrom: from,
      periodTo: to,
      totalNewUsers,
      totalNewBrands,
      totalNewOrders,
      totalRevenue: revenueAggregate._sum.subtotal ?? 0,
      currency: 'USD',
      series,
    };
  }

  private mergeSeries(
    userSeries: DailyCount[],
    brandSeries: DailyCount[],
    orderSeries: DailyCount[],
    revenueSeries: DailyRevenue[],
  ): GrowthReportResponse['series'] {
    const byDate = new Map<
      string,
      {
        newUsers: number;
        newBrands: number;
        newOrders: number;
        revenue: number;
      }
    >();

    const ensure = (date: Date) => {
      const key = date.toISOString();
      if (!byDate.has(key)) {
        byDate.set(key, {
          newUsers: 0,
          newBrands: 0,
          newOrders: 0,
          revenue: 0,
        });
      }
      return byDate.get(key) as {
        newUsers: number;
        newBrands: number;
        newOrders: number;
        revenue: number;
      };
    };

    userSeries.forEach((row) => {
      ensure(row.bucket).newUsers = row.count;
    });
    brandSeries.forEach((row) => {
      ensure(row.bucket).newBrands = row.count;
    });
    orderSeries.forEach((row) => {
      ensure(row.bucket).newOrders = row.count;
    });
    revenueSeries.forEach((row) => {
      ensure(row.bucket).revenue = row.revenue;
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, point]) => ({ period, ...point }));
  }
}
