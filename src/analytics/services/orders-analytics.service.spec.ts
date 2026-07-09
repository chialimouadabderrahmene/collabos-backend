import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersAnalyticsService } from './orders-analytics.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'owner-1', roles: ['USER'], ...overrides };
}

describe('OrdersAnalyticsService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    order: {
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
  };
  let service: OrdersAnalyticsService;

  beforeEach(() => {
    prisma = {
      brand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'brand-1', ownerId: 'owner-1' }),
      },
      order: { count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
    };
    service = new OrdersAnalyticsService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('builds a status breakdown and average order value from revenue orders only', async () => {
      prisma.order.count
        .mockResolvedValueOnce(10) // totalOrders (all statuses)
        .mockResolvedValueOnce(6); // revenue-eligible order count
      prisma.order.groupBy.mockResolvedValue([
        { status: 'PAID', _count: 5 },
        { status: 'CANCELLED', _count: 3 },
        { status: 'REFUNDED', _count: 2 },
      ]);
      prisma.order.aggregate.mockResolvedValue({ _sum: { subtotal: 600 } });

      const result = await service.getSummary(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result).toEqual({
        totalOrders: 10,
        byStatus: { PAID: 5, CANCELLED: 3, REFUNDED: 2 },
        averageOrderValue: 100,
        currency: 'USD',
      });
    });
  });
});
