import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversionService } from './conversion.service';
import { OrdersAnalyticsService } from './orders-analytics.service';
import { ReportsService } from './reports.service';
import { RevenueService } from './revenue.service';
import { TrafficService } from './traffic.service';
import { VisitorsService } from './visitors.service';

function buildUser() {
  return { id: 'owner-1', roles: ['USER'] };
}

describe('ReportsService', () => {
  let revenueService: {
    getSummary: ReturnType<typeof vi.fn>;
    getSeries: ReturnType<typeof vi.fn>;
  };
  let ordersAnalyticsService: { getSummary: ReturnType<typeof vi.fn> };
  let trafficService: {
    getSummary: ReturnType<typeof vi.fn>;
    getSeries: ReturnType<typeof vi.fn>;
  };
  let visitorsService: { getSummary: ReturnType<typeof vi.fn> };
  let conversionService: { getConversion: ReturnType<typeof vi.fn> };
  let service: ReportsService;

  beforeEach(() => {
    revenueService = {
      getSummary: vi.fn().mockResolvedValue({
        totalRevenue: 1000,
        orderCount: 5,
        averageOrderValue: 200,
        currency: 'USD',
      }),
      getSeries: vi.fn().mockResolvedValue([
        { date: new Date('2026-01-01'), revenue: 500, orders: 2 },
        { date: new Date('2026-01-02'), revenue: 500, orders: 3 },
      ]),
    };
    ordersAnalyticsService = {
      getSummary: vi.fn().mockResolvedValue({
        totalOrders: 5,
        byStatus: { PAID: 5 },
        averageOrderValue: 200,
        currency: 'USD',
      }),
    };
    trafficService = {
      getSummary: vi
        .fn()
        .mockResolvedValue({ totalViews: 100, uniqueVisitors: 20 }),
      getSeries: vi.fn().mockResolvedValue([
        { date: new Date('2026-01-01'), views: 50, uniqueVisitors: 10 },
        { date: new Date('2026-01-02'), views: 50, uniqueVisitors: 10 },
      ]),
    };
    visitorsService = {
      getSummary: vi.fn().mockResolvedValue({
        totalViews: 100,
        uniqueVisitors: 20,
        averageViewsPerVisitor: 5,
        topPages: [],
      }),
    };
    conversionService = {
      getConversion: vi.fn().mockResolvedValue({
        uniqueVisitors: 20,
        orders: 5,
        conversionRate: 0.25,
      }),
    };

    service = new ReportsService(
      revenueService as unknown as RevenueService,
      ordersAnalyticsService as unknown as OrdersAnalyticsService,
      trafficService as unknown as TrafficService,
      visitorsService as unknown as VisitorsService,
      conversionService as unknown as ConversionService,
    );
  });

  describe('getSummary', () => {
    it('composes all metrics into a single report', async () => {
      const result = await service.getSummary(
        { brandId: 'brand-1', from: '2026-01-01', to: '2026-01-31' },
        buildUser() as never,
      );

      expect(result.revenue.totalRevenue).toBe(1000);
      expect(result.orders.totalOrders).toBe(5);
      expect(result.traffic.totalViews).toBe(100);
      expect(result.visitors.uniqueVisitors).toBe(20);
      expect(result.conversion.conversionRate).toBe(0.25);
      expect(result.periodFrom).toEqual(new Date('2026-01-01'));
      expect(result.periodTo).toEqual(new Date('2026-01-31'));
    });
  });

  describe('exportCsv', () => {
    it('merges the revenue and traffic series into CSV rows by date', async () => {
      const csv = await service.exportCsv(
        { brandId: 'brand-1' },
        buildUser() as never,
      );

      const lines = csv.split('\n');
      expect(lines[0]).toBe('date,revenue,orders,views,uniqueVisitors');
      expect(lines).toHaveLength(3);
      expect(lines[1]).toBe(
        `${new Date('2026-01-01').toISOString()},500,2,50,10`,
      );
    });
  });
});
