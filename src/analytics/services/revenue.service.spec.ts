import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsGranularity } from '../dto/analytics-series-query.dto';
import { RevenueService } from './revenue.service';

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'brand-1', ownerId: 'owner-1', ...overrides };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'owner-1', roles: ['USER'], ...overrides };
}

describe('RevenueService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    order: {
      aggregate: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: RevenueService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn().mockResolvedValue(buildBrand()) },
      order: { aggregate: vi.fn(), count: vi.fn() },
      $queryRaw: vi.fn(),
    };
    service = new RevenueService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('rejects a user who does not own the brand', async () => {
      await expect(
        service.getSummary(
          { brandId: 'brand-1' },
          buildUser({ id: 'stranger' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('computes total revenue and average order value', async () => {
      prisma.order.aggregate.mockResolvedValue({ _sum: { subtotal: 1000 } });
      prisma.order.count.mockResolvedValue(4);

      const result = await service.getSummary(
        { brandId: 'brand-1', from: '2026-01-01', to: '2026-01-31' },
        buildUser(),
      );

      expect(result).toEqual({
        totalRevenue: 1000,
        orderCount: 4,
        averageOrderValue: 250,
        currency: 'USD',
      });
    });

    it('returns zero average order value with no orders', async () => {
      prisma.order.aggregate.mockResolvedValue({ _sum: { subtotal: null } });
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getSummary(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result.totalRevenue).toBe(0);
      expect(result.averageOrderValue).toBe(0);
    });
  });

  describe('getSeries', () => {
    it('maps raw bucketed rows into series points', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: new Date('2026-01-01'), revenue: 300, orders: 2 },
        { bucket: new Date('2026-01-02'), revenue: 0, orders: 0 },
      ]);

      const result = await service.getSeries(
        {
          brandId: 'brand-1',
          granularity: AnalyticsGranularity.DAY,
        },
        buildUser(),
      );

      expect(result).toEqual([
        { date: new Date('2026-01-01'), revenue: 300, orders: 2 },
        { date: new Date('2026-01-02'), revenue: 0, orders: 0 },
      ]);
    });
  });
});
