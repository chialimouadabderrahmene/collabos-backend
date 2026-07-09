import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from './balance.service';

describe('BalanceService', () => {
  let prisma: {
    paymentSplit: { aggregate: ReturnType<typeof vi.fn> };
    payout: { aggregate: ReturnType<typeof vi.fn> };
  };
  let service: BalanceService;

  beforeEach(() => {
    prisma = {
      paymentSplit: { aggregate: vi.fn() },
      payout: { aggregate: vi.fn() },
    };
    service = new BalanceService(prisma as unknown as PrismaService);
  });

  describe('getBalance', () => {
    it('computes available balance as earned minus pending and paid payouts', async () => {
      prisma.paymentSplit.aggregate.mockResolvedValue({
        _sum: { amount: 500 },
      });
      prisma.payout.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50 } }) // pending + in_transit
        .mockResolvedValueOnce({ _sum: { amount: 200 } }); // paid

      const result = await service.getBalance('user-1');

      expect(result).toEqual({
        available: 250,
        pendingWithdrawals: 50,
        totalWithdrawn: 200,
        totalEarned: 500,
        currency: 'USD',
      });
    });

    it('treats missing aggregates as zero', async () => {
      prisma.paymentSplit.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      prisma.payout.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getBalance('user-1');

      expect(result.available).toBe(0);
    });
  });
});
