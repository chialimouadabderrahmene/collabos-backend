import { Injectable } from '@nestjs/common';
import { DealStatus, ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { REVENUE_ORDER_STATUSES } from '../constants/revenue-statuses.constant';
import { DashboardResponse } from '../types/admin-response.types';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<DashboardResponse> {
    const [
      totalUsers,
      activeUsers,
      totalBrands,
      verifiedBrands,
      totalOrders,
      revenueAggregate,
      totalDeals,
      activeDeals,
      pendingModerationCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.brand.count(),
      this.prisma.brand.count({ where: { isVerified: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_ORDER_STATUSES } },
        _sum: { subtotal: true },
      }),
      this.prisma.deal.count(),
      this.prisma.deal.count({ where: { status: DealStatus.ACTIVE } }),
      this.prisma.contentReport.count({
        where: { status: ReportStatus.PENDING },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalBrands,
      verifiedBrands,
      totalOrders,
      totalRevenue: revenueAggregate._sum.subtotal ?? 0,
      totalDeals,
      activeDeals,
      pendingModerationCount,
      currency: 'USD',
    };
  }
}
