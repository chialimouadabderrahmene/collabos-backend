import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let prisma: {
    transaction: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: TransactionsService;

  beforeEach(() => {
    prisma = {
      transaction: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new TransactionsService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('creates a transaction row with the given fields', async () => {
      await service.record({
        userId: 'user-1',
        type: 'CHARGE',
        amount: -120,
        currency: 'USD',
        paymentId: 'payment-1',
        description: 'Payment charged',
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'CHARGE',
          amount: -120,
          currency: 'USD',
          paymentId: 'payment-1',
          description: 'Payment charged',
        },
      });
    });
  });

  describe('findMine', () => {
    it('returns a paginated ledger filtered by type', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          type: 'TRANSFER',
          amount: 108,
          currency: 'USD',
          paymentId: 'payment-1',
          description: 'Escrow release',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findMine('user-1', {
        page: 1,
        limit: 20,
        type: 'TRANSFER',
      });

      expect(result.total).toBe(1);
      expect(result.data[0].type).toBe('TRANSFER');
    });
  });
});
