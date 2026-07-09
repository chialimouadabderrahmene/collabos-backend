import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let prisma: { pageView: { create: ReturnType<typeof vi.fn> } };
  let service: TrackingService;

  beforeEach(() => {
    prisma = { pageView: { create: vi.fn() } };
    service = new TrackingService(prisma as unknown as PrismaService);
  });

  describe('track', () => {
    it('creates a page view row from the dto', async () => {
      await service.track({
        brandId: 'brand-1',
        targetType: 'PRODUCT',
        targetId: 'product-1',
        visitorId: 'visitor-1',
        referrer: 'https://google.com',
      } as never);

      expect(prisma.pageView.create).toHaveBeenCalledWith({
        data: {
          brandId: 'brand-1',
          targetType: 'PRODUCT',
          targetId: 'product-1',
          visitorId: 'visitor-1',
          referrer: 'https://google.com',
        },
      });
    });
  });
});
