import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsGranularity } from '../dto/analytics-series-query.dto';
import { TrafficService } from './traffic.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'owner-1', roles: ['USER'], ...overrides };
}

describe('TrafficService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    pageView: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let service: TrafficService;

  beforeEach(() => {
    prisma = {
      brand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'brand-1', ownerId: 'owner-1' }),
      },
      pageView: { count: vi.fn(), findMany: vi.fn() },
      $queryRaw: vi.fn(),
    };
    service = new TrafficService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('returns total views and unique visitor count', async () => {
      prisma.pageView.count.mockResolvedValue(50);
      prisma.pageView.findMany.mockResolvedValue([
        { visitorId: 'v1' },
        { visitorId: 'v2' },
      ]);

      const result = await service.getSummary(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result).toEqual({ totalViews: 50, uniqueVisitors: 2 });
    });
  });

  describe('getSeries', () => {
    it('maps raw bucketed rows into series points', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: new Date('2026-01-01'), views: 10, uniquevisitors: 4 },
      ]);

      const result = await service.getSeries(
        {
          brandId: 'brand-1',
          granularity: AnalyticsGranularity.DAY,
        },
        buildUser(),
      );

      expect(result).toEqual([
        { date: new Date('2026-01-01'), views: 10, uniqueVisitors: 4 },
      ]);
    });
  });
});
