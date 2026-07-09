import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  let prisma: {
    paymentSplit: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: TransfersService;

  beforeEach(() => {
    prisma = {
      paymentSplit: { findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new TransfersService(prisma as unknown as PrismaService);
  });

  describe('findMine', () => {
    it('returns paginated released transfers for the recipient', async () => {
      prisma.paymentSplit.findMany.mockResolvedValue([
        {
          id: 'split-1',
          paymentId: 'payment-1',
          amount: 108,
          stripeTransferId: 'tr_123',
          releasedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      prisma.paymentSplit.count.mockResolvedValue(1);

      const result = await service.findMine('user-1', { page: 1, limit: 20 });

      expect(prisma.paymentSplit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientUserId: 'user-1',
            isPlatformFee: false,
            status: 'RELEASED',
          },
        }),
      );
      expect(result.total).toBe(1);
      expect(result.data[0].stripeTransferId).toBe('tr_123');
    });
  });
});
