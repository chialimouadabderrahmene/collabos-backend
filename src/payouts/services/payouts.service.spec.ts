import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from './balance.service';
import { PayoutsService } from './payouts.service';
import { StripeService } from './stripe.service';

function buildAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'acct-row-1',
    userId: 'user-1',
    stripeAccountId: 'acct_123',
    status: 'ACTIVE',
    ...overrides,
  };
}

function buildBalance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    available: 300,
    pendingWithdrawals: 0,
    totalWithdrawn: 0,
    totalEarned: 300,
    currency: 'USD',
    ...overrides,
  };
}

function buildPayout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'payout-1',
    userId: 'user-1',
    stripeAccountId: 'acct_123',
    stripePayoutId: null,
    amount: 300,
    currency: 'USD',
    status: 'PENDING',
    failureReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'user-1', roles: ['USER'], ...overrides };
}

describe('PayoutsService', () => {
  let prisma: {
    connectedAccount: { findUnique: ReturnType<typeof vi.fn> };
    payout: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    transaction: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };
  let stripeService: { createPayout: ReturnType<typeof vi.fn> };
  let balanceService: { getBalance: ReturnType<typeof vi.fn> };
  let service: PayoutsService;

  beforeEach(() => {
    prisma = {
      connectedAccount: { findUnique: vi.fn() },
      payout: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      transaction: { create: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    configService = { get: vi.fn().mockReturnValue(20) };
    stripeService = {
      createPayout: vi
        .fn()
        .mockResolvedValue({ id: 'po_123', status: 'pending' }),
    };
    balanceService = { getBalance: vi.fn().mockResolvedValue(buildBalance()) };
    service = new PayoutsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      stripeService as unknown as StripeService,
      balanceService as unknown as BalanceService,
    );
  });

  describe('withdraw', () => {
    it('throws NotFoundException when no connected account exists', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(null);

      await expect(service.withdraw(buildUser(), {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when the connected account is not active', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(
        buildAccount({ status: 'PENDING' }),
      );

      await expect(service.withdraw(buildUser(), {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws BadRequestException when there is nothing to withdraw', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      balanceService.getBalance.mockResolvedValue(
        buildBalance({ available: 0 }),
      );

      await expect(service.withdraw(buildUser(), {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ConflictException when the requested amount exceeds the balance', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      balanceService.getBalance.mockResolvedValue(
        buildBalance({ available: 100 }),
      );

      await expect(
        service.withdraw(buildUser(), { amount: 500 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when the amount is below the configured minimum', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      balanceService.getBalance.mockResolvedValue(
        buildBalance({ available: 100 }),
      );
      configService.get.mockReturnValue(50);

      await expect(
        service.withdraw(buildUser(), { amount: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('converts the whole-currency amount to minor units for Stripe', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      prisma.payout.create.mockResolvedValue(buildPayout());
      prisma.payout.update.mockResolvedValue(
        buildPayout({ status: 'PENDING', stripePayoutId: 'po_123' }),
      );

      await service.withdraw(buildUser(), {});

      expect(stripeService.createPayout).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 30000, currency: 'USD' }),
      );

      const transactionCall = prisma.transaction.create.mock.calls[0][0] as {
        data: { type: string; amount: number };
      };
      expect(transactionCall.data.type).toBe('PAYOUT');
      expect(transactionCall.data.amount).toBe(-300);
    });

    it('defaults to the full available balance when no amount is given', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      prisma.payout.create.mockImplementation(
        ({ data }: { data: { amount: number } }) =>
          Promise.resolve(buildPayout({ amount: data.amount })),
      );
      prisma.payout.update.mockResolvedValue(buildPayout());

      await service.withdraw(buildUser(), {});

      const createCall = prisma.payout.create.mock.calls[0][0] as {
        data: { amount: number };
      };
      expect(createCall.data.amount).toBe(300);
    });

    it('marks the payout FAILED and rethrows when Stripe rejects the request', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(buildAccount());
      prisma.payout.create.mockResolvedValue(buildPayout());
      stripeService.createPayout.mockRejectedValue(
        new Error('insufficient funds'),
      );

      await expect(service.withdraw(buildUser(), {})).rejects.toBeInstanceOf(
        ConflictException,
      );

      const call = prisma.payout.update.mock.calls[0][0] as {
        data: { status: string; failureReason: string };
      };
      expect(call.data.status).toBe('FAILED');
      expect(call.data.failureReason).toBe('insufficient funds');
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneOrThrow('missing', buildUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a user who does not own the payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(buildPayout());

      await expect(
        service.findOneOrThrow('payout-1', buildUser({ id: 'stranger' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an admin to view any payout', async () => {
      prisma.payout.findUnique.mockResolvedValue(buildPayout());

      await expect(
        service.findOneOrThrow(
          'payout-1',
          buildUser({ id: 'admin-1', roles: ['ADMIN'] }),
        ),
      ).resolves.toEqual(expect.objectContaining({ id: 'payout-1' }));
    });
  });

  describe('findMine', () => {
    it('returns a paginated list scoped to the user', async () => {
      prisma.payout.findMany.mockResolvedValue([buildPayout()]);
      prisma.payout.count.mockResolvedValue(1);

      const result = await service.findMine('user-1', { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('payout-1');
    });
  });
});
