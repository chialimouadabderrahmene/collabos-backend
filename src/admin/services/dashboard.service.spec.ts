import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let prisma: {
    user: { count: ReturnType<typeof vi.fn> };
    brand: { count: ReturnType<typeof vi.fn> };
    order: {
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    deal: { count: ReturnType<typeof vi.fn> };
    contentReport: { count: ReturnType<typeof vi.fn> };
  };
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      user: { count: vi.fn() },
      brand: { count: vi.fn() },
      order: { count: vi.fn(), aggregate: vi.fn() },
      deal: { count: vi.fn() },
      contentReport: { count: vi.fn() },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  describe('getOverview', () => {
    it('aggregates every platform metric', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80); // activeUsers
      prisma.brand.count
        .mockResolvedValueOnce(20) // totalBrands
        .mockResolvedValueOnce(5); // verifiedBrands
      prisma.order.count.mockResolvedValue(300);
      prisma.order.aggregate.mockResolvedValue({ _sum: { subtotal: 50000 } });
      prisma.deal.count
        .mockResolvedValueOnce(40) // totalDeals
        .mockResolvedValueOnce(10); // activeDeals
      prisma.contentReport.count.mockResolvedValue(3);

      const result = await service.getOverview();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 80,
        totalBrands: 20,
        verifiedBrands: 5,
        totalOrders: 300,
        totalRevenue: 50000,
        totalDeals: 40,
        activeDeals: 10,
        pendingModerationCount: 3,
        currency: 'USD',
      });
    });

    it('treats a missing revenue aggregate as zero', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.brand.count.mockResolvedValue(0);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.aggregate.mockResolvedValue({ _sum: { subtotal: null } });
      prisma.deal.count.mockResolvedValue(0);
      prisma.contentReport.count.mockResolvedValue(0);

      const result = await service.getOverview();

      expect(result.totalRevenue).toBe(0);
    });
  });
});
