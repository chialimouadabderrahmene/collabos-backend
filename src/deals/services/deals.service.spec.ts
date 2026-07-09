import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DealsService } from './deals.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'creator-1',
    email: 'creator@example.com',
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
    ...overrides,
  };
}

function buildApplication(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'application-1',
    briefId: 'brief-1',
    applicantId: 'creator-1',
    status: 'ACCEPTED',
    brief: {
      id: 'brief-1',
      title: 'Look-book photography',
      brand: { id: 'brand-1', ownerId: 'owner-1' },
    },
    deal: null,
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'deal-1',
    applicationId: 'application-1',
    briefId: 'brief-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    title: 'Look-book photography',
    status: 'NEGOTIATING',
    totalValue: null,
    currency: 'USD',
    revenueSplitBrand: null,
    revenueSplitCreator: null,
    startDate: null,
    endDate: null,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DealsService', () => {
  let prisma: {
    application: { findUnique: ReturnType<typeof vi.fn> };
    deal: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    dealMilestone: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: DealsService;

  beforeEach(() => {
    prisma = {
      application: { findUnique: vi.fn() },
      deal: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      brand: { findUnique: vi.fn(), findMany: vi.fn() },
      dealMilestone: { findMany: vi.fn() },
      $transaction: vi.fn(),
    };
    service = new DealsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('throws NotFoundException when the application does not exist', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          applicationId: 'application-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the application is not accepted', async () => {
      prisma.application.findUnique.mockResolvedValue(
        buildApplication({ status: 'PENDING' }),
      );

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          applicationId: 'application-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ConflictException when a deal already exists', async () => {
      prisma.application.findUnique.mockResolvedValue(
        buildApplication({ deal: buildDeal() }),
      );

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          applicationId: 'application-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());

      await expect(
        service.create(buildUser({ id: 'stranger' }), {
          applicationId: 'application-1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a revenue split that does not add up to 100', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          applicationId: 'application-1',
          revenueSplitBrand: 40,
          revenueSplitCreator: 50,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a negotiating deal with an initial proposal', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.deal.create.mockResolvedValue(buildDeal());

      const result = await service.create(buildUser({ id: 'owner-1' }), {
        applicationId: 'application-1',
      });

      expect(result.status).toBe('NEGOTIATING');
      expect(result.brandId).toBe('brand-1');
      expect(result.creatorId).toBe('creator-1');
    });
  });

  describe('assertParticipant', () => {
    it('allows the creator', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(buildDeal(), buildUser()),
      ).resolves.toBeUndefined();
    });

    it('allows the brand owner', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(buildDeal(), buildUser({ id: 'owner-1' })),
      ).resolves.toBeUndefined();
    });

    it('rejects an unrelated user', async () => {
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      await expect(
        service.assertParticipant(buildDeal(), buildUser({ id: 'stranger' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('complete', () => {
    it('rejects completing a deal that is not active', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ status: 'NEGOTIATING' }),
      );
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.complete('deal-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('completes an active deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal({ status: 'ACTIVE' }));
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.deal.update.mockResolvedValue(
        buildDeal({ status: 'COMPLETED', completedAt: new Date() }),
      );

      const result = await service.complete('deal-1', buildUser());
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('cancel', () => {
    it('rejects cancelling an already-completed deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ status: 'COMPLETED' }),
      );
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      await expect(
        service.cancel('deal-1', buildUser(), {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cancels a negotiating deal with a reason', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.brand.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.deal.update.mockResolvedValue(
        buildDeal({ status: 'CANCELLED', cancelReason: 'Changed plans' }),
      );

      const result = await service.cancel('deal-1', buildUser(), {
        reason: 'Changed plans',
      });
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelReason).toBe('Changed plans');
    });
  });
});
