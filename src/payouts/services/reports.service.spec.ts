import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let prisma: {
    paymentSplit: { aggregate: ReturnType<typeof vi.fn> };
    payout: {
      aggregate: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      paymentSplit: { aggregate: vi.fn() },
      payout: { aggregate: vi.fn(), count: vi.fn() },
    };
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('summarizes earnings and withdrawals with no date range', async () => {
      prisma.paymentSplit.aggregate.mockResolvedValue({
        _sum: { amount: 900 },
      });
      prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 400 } });
      prisma.payout.count.mockResolvedValue(3);

      const result = await service.getSummary('user-1', {});

      expect(result).toEqual({
        periodFrom: null,
        periodTo: null,
        totalEarned: 900,
        totalWithdrawn: 400,
        payoutCount: 3,
        currency: 'USD',
      });
    });

    it('scopes the aggregates to the given date range', async () => {
      prisma.paymentSplit.aggregate.mockResolvedValue({
        _sum: { amount: 100 },
      });
      prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 50 } });
      prisma.payout.count.mockResolvedValue(1);

      const result = await service.getSummary('user-1', {
        from: '2026-01-01',
        to: '2026-01-31',
      });

      const call = prisma.paymentSplit.aggregate.mock.calls[0][0] as {
        where: { recipientUserId: string };
      };
      expect(call.where.recipientUserId).toBe('user-1');
      expect(result.periodFrom).toEqual(new Date('2026-01-01'));
      expect(result.periodTo).toEqual(new Date('2026-01-31'));
    });
  });
});
