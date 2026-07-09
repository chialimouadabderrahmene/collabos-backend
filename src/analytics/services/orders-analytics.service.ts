import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { REVENUE_ORDER_STATUSES } from '../constants/revenue-statuses.constant';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { OrdersSummaryResponse } from '../types/analytics-response.types';
import { assertBrandOwner } from '../utils/assert-brand-owner.util';
import { resolveDateRange } from '../utils/resolve-date-range.util';

@Injectable()
export class OrdersAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<OrdersSummaryResponse> {
    await assertBrandOwner(this.prisma, query.brandId, user);
    const { from, to } = resolveDateRange(query);

    const dateWhere = {
      brandId: query.brandId,
      createdAt: { gte: from, lte: to },
    };

    const [totalOrders, statusGroups, revenueAggregate, revenueOrderCount] =
      await Promise.all([
        this.prisma.order.count({ where: dateWhere }),
        this.prisma.order.groupBy({
          by: ['status'],
          where: dateWhere,
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { ...dateWhere, status: { in: REVENUE_ORDER_STATUSES } },
          _sum: { subtotal: true },
        }),
        this.prisma.order.count({
          where: { ...dateWhere, status: { in: REVENUE_ORDER_STATUSES } },
        }),
      ]);

    const byStatus = statusGroups.reduce<Partial<Record<OrderStatus, number>>>(
      (acc, group) => {
        acc[group.status] = group._count;
        return acc;
      },
      {},
    );

    const totalRevenue = revenueAggregate._sum.subtotal ?? 0;
    const averageOrderValue =
      revenueOrderCount > 0
        ? Math.round((totalRevenue / revenueOrderCount) * 100) / 100
        : 0;

    return {
      totalOrders,
      byStatus,
      averageOrderValue,
      currency: 'USD',
    };
  }
}
