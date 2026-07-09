import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorsService } from './visitors.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'owner-1', roles: ['USER'], ...overrides };
}

describe('VisitorsService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    pageView: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
  };
  let service: VisitorsService;

  beforeEach(() => {
    prisma = {
      brand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'brand-1', ownerId: 'owner-1' }),
      },
      pageView: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    };
    service = new VisitorsService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('returns visitor totals with the top pages sorted by views desc', async () => {
      prisma.pageView.count.mockResolvedValue(100);
      prisma.pageView.findMany.mockResolvedValue([
        { visitorId: 'v1' },
        { visitorId: 'v2' },
      ]);
      prisma.pageView.groupBy.mockResolvedValue([
        { targetType: 'PRODUCT', targetId: 'p1', _count: 10 },
        { targetType: 'PRODUCT', targetId: 'p2', _count: 40 },
        { targetType: 'DROP', targetId: 'd1', _count: 20 },
      ]);

      const result = await service.getSummary(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result.totalViews).toBe(100);
      expect(result.uniqueVisitors).toBe(2);
      expect(result.averageViewsPerVisitor).toBe(50);
      expect(result.topPages[0]).toEqual({
        targetType: 'PRODUCT',
        targetId: 'p2',
        views: 40,
      });
    });

    it('returns zero average views per visitor with no visitors', async () => {
      prisma.pageView.count.mockResolvedValue(0);
      prisma.pageView.findMany.mockResolvedValue([]);
      prisma.pageView.groupBy.mockResolvedValue([]);

      const result = await service.getSummary(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result.averageViewsPerVisitor).toBe(0);
      expect(result.topPages).toEqual([]);
    });
  });
});
