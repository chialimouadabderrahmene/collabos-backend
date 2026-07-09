import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { RefundsService } from './refunds.service';

function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    brandId: 'brand-1',
    status: 'PAID',
    subtotal: 10000,
    ...overrides,
  };
}

function buildRefund(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'refund-1',
    orderId: 'order-1',
    requestedById: 'buyer-1',
    amount: 5000,
    reason: 'Damaged item',
    status: 'PENDING',
    rejectedReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
    ...overrides,
  };
}

describe('RefundsService', () => {
  let prisma: {
    refund: {
      aggregate: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    order: { update: ReturnType<typeof vi.fn> };
  };
  let ordersService: OrdersService;
  let service: RefundsService;

  beforeEach(() => {
    prisma = {
      refund: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: { update: vi.fn() },
    };
    ordersService = {
      findEntityOrThrow: vi.fn().mockResolvedValue(buildOrder()),
      assertParticipant: vi.fn().mockResolvedValue(undefined),
      assertBrandOwnerOrAdmin: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrdersService;
    service = new RefundsService(
      prisma as unknown as PrismaService,
      ordersService,
    );
  });

  describe('create', () => {
    it('rejects a refund request from a non-buyer', async () => {
      await expect(
        service.create('order-1', { id: 'stranger' } as never, {
          amount: 1000,
          reason: 'Damaged item',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a refund for an order that is not eligible', async () => {
      vi.spyOn(ordersService, 'findEntityOrThrow').mockResolvedValue(
        buildOrder({ status: 'PENDING_PAYMENT' }) as never,
      );

      await expect(
        service.create('order-1', { id: 'buyer-1' } as never, {
          amount: 1000,
          reason: 'Damaged item',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a refund amount exceeding the remaining balance', async () => {
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 6000 } });

      await expect(
        service.create('order-1', { id: 'buyer-1' } as never, {
          amount: 5000,
          reason: 'Damaged item',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a pending refund within the refundable balance', async () => {
      prisma.refund.create.mockResolvedValue(buildRefund());

      const result = await service.create(
        'order-1',
        { id: 'buyer-1' } as never,
        {
          amount: 5000,
          reason: 'Damaged item',
        },
      );

      expect(result.status).toBe('PENDING');
    });
  });

  describe('approve', () => {
    it('marks the order fully REFUNDED once the refunded amount covers the subtotal', async () => {
      prisma.refund.findUnique.mockResolvedValue(buildRefund());
      prisma.refund.update.mockResolvedValue(
        buildRefund({ status: 'PROCESSED', processedAt: new Date() }),
      );
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 10000 } });

      await service.approve('order-1', 'refund-1', { id: 'owner-1' } as never);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('marks the order PARTIALLY_REFUNDED for a partial refund', async () => {
      prisma.refund.findUnique.mockResolvedValue(buildRefund());
      prisma.refund.update.mockResolvedValue(
        buildRefund({ status: 'PROCESSED', processedAt: new Date() }),
      );
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });

      await service.approve('order-1', 'refund-1', { id: 'owner-1' } as never);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'PARTIALLY_REFUNDED' },
      });
    });

    it('rejects deciding a non-pending refund', async () => {
      prisma.refund.findUnique.mockResolvedValue(
        buildRefund({ status: 'PROCESSED' }),
      );

      await expect(
        service.approve('order-1', 'refund-1', { id: 'owner-1' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reject', () => {
    it('rejects the refund with a reason', async () => {
      prisma.refund.findUnique.mockResolvedValue(buildRefund());
      prisma.refund.update.mockResolvedValue(
        buildRefund({ status: 'REJECTED', rejectedReason: 'Out of policy' }),
      );

      const result = await service.reject(
        'order-1',
        'refund-1',
        { id: 'owner-1' } as never,
        { reason: 'Out of policy' },
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectedReason).toBe('Out of policy');
    });
  });
});
