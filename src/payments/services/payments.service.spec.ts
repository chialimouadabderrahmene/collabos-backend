import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectService } from './connect.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { TransactionsService } from './transactions.service';

function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    brandId: 'brand-1',
    status: 'PENDING_PAYMENT',
    subtotal: 120,
    currency: 'USD',
    payment: null,
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'deal-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    status: 'ACTIVE',
    totalValue: 1000,
    currency: 'USD',
    payment: null,
    ...overrides,
  };
}

function buildPayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'payment-1',
    stripePaymentIntentId: 'pi_123',
    payerId: 'buyer-1',
    orderId: 'order-1',
    dealId: null,
    amount: 120,
    currency: 'USD',
    status: 'SUCCEEDED',
    clientSecret: 'secret',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    splits: [
      {
        id: 'split-fee',
        isPlatformFee: true,
        recipientUserId: null,
        amount: 12,
        status: 'PENDING',
      },
      {
        id: 'split-recipient',
        isPlatformFee: false,
        recipientUserId: 'owner-1',
        amount: 108,
        status: 'PENDING',
      },
    ],
    ...overrides,
  };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'buyer-1', roles: ['USER'], ...overrides };
}

describe('PaymentsService', () => {
  let prisma: {
    order: { findUnique: ReturnType<typeof vi.fn> };
    deal: { findUnique: ReturnType<typeof vi.fn> };
    brand: { findUnique: ReturnType<typeof vi.fn> };
    payment: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    paymentSplit: {
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };
  let stripeService: {
    createPaymentIntent: ReturnType<typeof vi.fn>;
    createTransfer: ReturnType<typeof vi.fn>;
    createRefund: ReturnType<typeof vi.fn>;
  };
  let connectService: { getRecipientAccountOrThrow: ReturnType<typeof vi.fn> };
  let transactionsService: { record: ReturnType<typeof vi.fn> };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      order: { findUnique: vi.fn() },
      deal: { findUnique: vi.fn() },
      brand: { findUnique: vi.fn() },
      payment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      paymentSplit: { update: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    configService = { get: vi.fn().mockReturnValue(10) };
    stripeService = {
      createPaymentIntent: vi
        .fn()
        .mockResolvedValue({ id: 'pi_123', client_secret: 'secret' }),
      createTransfer: vi.fn().mockResolvedValue({ id: 'tr_123' }),
      createRefund: vi.fn().mockResolvedValue({ id: 're_123' }),
    };
    connectService = {
      getRecipientAccountOrThrow: vi.fn().mockResolvedValue('acct_123'),
    };
    transactionsService = { record: vi.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      stripeService as unknown as StripeService,
      connectService as unknown as ConnectService,
      transactionsService as unknown as TransactionsService,
    );
  });

  describe('createForOrder', () => {
    it('throws ForbiddenException for a non-buyer', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder());

      await expect(
        service.createForOrder('order-1', buildUser({ id: 'stranger' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when the order is not awaiting payment', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'PAID' }));

      await expect(
        service.createForOrder('order-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('converts the whole-currency amount to minor units for Stripe', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder());
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
      });
      prisma.payment.create.mockResolvedValue(
        buildPayment({ status: 'REQUIRES_PAYMENT' }),
      );

      await service.createForOrder('order-1', buildUser());

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12000, currency: 'USD' }),
      );
    });

    it('never charges Stripe in a different currency than the order (EUR order)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        buildOrder({ subtotal: 840, currency: 'EUR' }),
      );
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
      });
      prisma.payment.create.mockResolvedValue(
        buildPayment({ amount: 840, currency: 'EUR' }),
      );

      await service.createForOrder('order-1', buildUser());

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 84000, currency: 'EUR' }),
      );
      expect(stripeService.createPaymentIntent).not.toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
      );
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'EUR',
          amount: 840,
        }) as Record<string, unknown>,
        include: { splits: true },
      });
    });

    it('splits 10% platform fee and 90% to the brand owner', async () => {
      prisma.order.findUnique.mockResolvedValue(buildOrder());
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
      });
      prisma.payment.create.mockImplementation(
        ({ data }: { data: { splits: { create: unknown[] } } }) =>
          Promise.resolve(buildPayment({ splits: data.splits.create })),
      );

      const result = await service.createForOrder('order-1', buildUser());

      expect(result.splits).toEqual([
        expect.objectContaining({ isPlatformFee: true, amount: 12 }),
        expect.objectContaining({ recipientUserId: 'owner-1', amount: 108 }),
      ]);
    });
  });

  describe('createForDeal', () => {
    it('throws ForbiddenException when the requester is not the brand owner', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
      });

      await expect(
        service.createForDeal('deal-1', buildUser({ id: 'stranger' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the deal has no agreed total value', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal({ totalValue: null }));

      await expect(
        service.createForDeal('deal-1', buildUser({ id: 'owner-1' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('funds the deal with the creator as recipient', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
      });
      prisma.payment.create.mockImplementation(
        ({ data }: { data: { splits: { create: unknown[] } } }) =>
          Promise.resolve(
            buildPayment({ dealId: 'deal-1', splits: data.splits.create }),
          ),
      );

      const result = await service.createForDeal(
        'deal-1',
        buildUser({ id: 'owner-1' }),
      );

      expect(result.splits[1]).toEqual(
        expect.objectContaining({ recipientUserId: 'creator-1' }),
      );
    });
  });

  describe('release', () => {
    it('rejects a non-admin', async () => {
      await expect(
        service.release('payment-1', buildUser({ roles: ['USER'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a payment that has not succeeded', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        buildPayment({ status: 'REQUIRES_PAYMENT' }),
      );

      await expect(
        service.release('payment-1', buildUser({ roles: ['ADMIN'] })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects release before the linked order is fulfilled', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildPayment());
      prisma.order.findUnique.mockResolvedValue(buildOrder({ status: 'PAID' }));

      await expect(
        service.release('payment-1', buildUser({ roles: ['ADMIN'] })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(stripeService.createTransfer).not.toHaveBeenCalled();
    });

    it('transfers minor-unit amounts to the recipient once fulfilled', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildPayment());
      prisma.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'FULFILLED' }),
      );

      await service.release('payment-1', buildUser({ roles: ['ADMIN'] }));

      expect(stripeService.createTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10800,
          destinationAccountId: 'acct_123',
        }),
      );
      expect(transactionsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          type: 'TRANSFER',
          amount: 108,
        }),
      );
    });
  });

  describe('refund', () => {
    it('rejects refunding a payment with already-released splits', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        buildPayment({
          splits: [
            {
              id: 's1',
              isPlatformFee: true,
              recipientUserId: null,
              amount: 12,
              status: 'RELEASED',
            },
          ],
        }),
      );

      await expect(
        service.refund('payment-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it('rejects a user who is neither payer nor admin', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildPayment());

      await expect(
        service.refund(
          'payment-1',
          buildUser({ id: 'stranger', roles: ['USER'] }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refunds via Stripe and records a REFUND transaction', async () => {
      prisma.payment.findUnique.mockResolvedValue(buildPayment());

      await service.refund('payment-1', buildUser());

      expect(stripeService.createRefund).toHaveBeenCalledWith('pi_123');
      expect(transactionsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: 'REFUND',
          amount: 120,
        }),
      );
    });
  });

  describe('assertParticipant', () => {
    it('allows a split recipient', () => {
      expect(() =>
        service.assertParticipant(
          buildPayment() as never,
          buildUser({ id: 'owner-1' }),
        ),
      ).not.toThrow();
    });

    it('rejects an unrelated user', () => {
      expect(() =>
        service.assertParticipant(
          buildPayment() as never,
          buildUser({ id: 'stranger' }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('findEntityOrThrow', () => {
    it('throws NotFoundException for a missing payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findEntityOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
