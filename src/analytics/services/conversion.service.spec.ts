import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversionService } from './conversion.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'owner-1', roles: ['USER'], ...overrides };
}

describe('ConversionService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    pageView: { findMany: ReturnType<typeof vi.fn> };
    order: { count: ReturnType<typeof vi.fn> };
  };
  let service: ConversionService;

  beforeEach(() => {
    prisma = {
      brand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'brand-1', ownerId: 'owner-1' }),
      },
      pageView: { findMany: vi.fn() },
      order: { count: vi.fn() },
    };
    service = new ConversionService(prisma as unknown as PrismaService);
  });

  describe('getConversion', () => {
    it('computes the conversion rate as orders over unique visitors', async () => {
      prisma.pageView.findMany.mockResolvedValue([
        { visitorId: 'v1' },
        { visitorId: 'v2' },
        { visitorId: 'v3' },
        { visitorId: 'v4' },
      ]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getConversion(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result).toEqual({
        uniqueVisitors: 4,
        orders: 1,
        conversionRate: 0.25,
      });
    });

    it('returns a zero rate when there are no visitors', async () => {
      prisma.pageView.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getConversion(
        { brandId: 'brand-1' },
        buildUser(),
      );

      expect(result.conversionRate).toBe(0);
    });
  });
});
