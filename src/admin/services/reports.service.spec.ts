import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let prisma: {
    user: { count: ReturnType<typeof vi.fn> };
    brand: { count: ReturnType<typeof vi.fn> };
    order: {
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      user: { count: vi.fn().mockResolvedValue(5) },
      brand: { count: vi.fn().mockResolvedValue(2) },
      order: {
        count: vi.fn().mockResolvedValue(10),
        aggregate: vi.fn().mockResolvedValue({ _sum: { subtotal: 1000 } }),
      },
      $queryRaw: vi.fn(),
    };
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  describe('getGrowthReport', () => {
    it('returns platform-wide totals for the period', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getGrowthReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(result.totalNewUsers).toBe(5);
      expect(result.totalNewBrands).toBe(2);
      expect(result.totalNewOrders).toBe(10);
      expect(result.totalRevenue).toBe(1000);
      expect(result.periodFrom).toEqual(new Date('2026-01-01'));
      expect(result.periodTo).toEqual(new Date('2026-01-31'));
    });

    it('merges the four daily series into one series by date', async () => {
      const day1 = new Date('2026-01-01');
      const day2 = new Date('2026-01-02');

      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: day1, count: 3 }]) // users
        .mockResolvedValueOnce([{ bucket: day1, count: 1 }]) // brands
        .mockResolvedValueOnce([
          { bucket: day1, count: 2 },
          { bucket: day2, count: 4 },
        ]) // orders
        .mockResolvedValueOnce([{ bucket: day2, revenue: 500 }]); // revenue

      const result = await service.getGrowthReport({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(result.series).toEqual([
        {
          period: day1.toISOString(),
          newUsers: 3,
          newBrands: 1,
          newOrders: 2,
          revenue: 0,
        },
        {
          period: day2.toISOString(),
          newUsers: 0,
          newBrands: 0,
          newOrders: 4,
          revenue: 500,
        },
      ]);
    });
  });
});
