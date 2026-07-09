import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectService } from './connect.service';
import { StripeService } from './stripe.service';

describe('ConnectService', () => {
  let prisma: {
    connectedAccount: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let stripeService: {
    createConnectedAccount: ReturnType<typeof vi.fn>;
    createAccountLink: ReturnType<typeof vi.fn>;
  };
  let service: ConnectService;

  beforeEach(() => {
    prisma = {
      connectedAccount: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    stripeService = {
      createConnectedAccount: vi.fn().mockResolvedValue({ id: 'acct_123' }),
      createAccountLink: vi
        .fn()
        .mockResolvedValue({ url: 'https://connect.stripe.com/setup' }),
    };
    service = new ConnectService(
      prisma as unknown as PrismaService,
      stripeService as unknown as StripeService,
    );
  });

  describe('onboard', () => {
    it('creates a new Stripe account and local record on first onboarding', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(null);
      prisma.connectedAccount.create.mockResolvedValue({
        id: 'row-1',
        stripeAccountId: 'acct_123',
      });

      const result = await service.onboard({
        id: 'user-1',
        email: 'brand@example.com',
      } as never);

      expect(stripeService.createConnectedAccount).toHaveBeenCalledWith(
        'brand@example.com',
      );
      expect(result.url).toBe('https://connect.stripe.com/setup');
    });

    it('reuses an existing pending account without re-creating it on Stripe', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({
        id: 'row-1',
        stripeAccountId: 'acct_123',
        status: 'PENDING',
      });

      await service.onboard({
        id: 'user-1',
        email: 'brand@example.com',
      } as never);

      expect(stripeService.createConnectedAccount).not.toHaveBeenCalled();
      expect(stripeService.createAccountLink).toHaveBeenCalledWith('acct_123');
    });

    it('rejects re-onboarding an already-active account', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({
        id: 'row-1',
        stripeAccountId: 'acct_123',
        status: 'ACTIVE',
      });

      await expect(
        service.onboard({ id: 'user-1', email: 'brand@example.com' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getStatus', () => {
    it('throws NotFoundException when no account exists', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.getStatus({ id: 'user-1' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('syncFromStripeAccount', () => {
    it('marks the account ACTIVE once charges and payouts are enabled', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({ id: 'row-1' });

      await service.syncFromStripeAccount({
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {},
      } as never);

      expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: {
          status: 'ACTIVE',
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      });
    });

    it('marks the account RESTRICTED when Stripe reports a disabled reason', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({ id: 'row-1' });

      await service.syncFromStripeAccount({
        id: 'acct_123',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { disabled_reason: 'requirements.past_due' },
      } as never);

      const call = prisma.connectedAccount.update.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(call.data.status).toBe('RESTRICTED');
    });
  });

  describe('getRecipientAccountOrThrow', () => {
    it('rejects a recipient without completed payout onboarding', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({
        stripeAccountId: 'acct_123',
        payoutsEnabled: false,
      });

      await expect(
        service.getRecipientAccountOrThrow('user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the Stripe account id when payouts are enabled', async () => {
      prisma.connectedAccount.findUnique.mockResolvedValue({
        stripeAccountId: 'acct_123',
        payoutsEnabled: true,
      });

      await expect(service.getRecipientAccountOrThrow('user-1')).resolves.toBe(
        'acct_123',
      );
    });
  });
});
