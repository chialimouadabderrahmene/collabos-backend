import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DealsService } from './deals.service';
import { ProposalsService } from './proposals.service';

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

function buildDeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'deal-1',
    brandId: 'brand-1',
    creatorId: 'creator-1',
    status: 'NEGOTIATING',
    ...overrides,
  };
}

function buildProposal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'proposal-1',
    dealId: 'deal-1',
    proposedById: 'owner-1',
    status: 'PENDING',
    totalValue: 1000,
    revenueSplitBrand: 30,
    revenueSplitCreator: 70,
    startDate: null,
    endDate: null,
    message: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    respondedAt: null,
    ...overrides,
  };
}

describe('ProposalsService', () => {
  let prisma: {
    dealProposal: {
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    deal: { update: ReturnType<typeof vi.fn> };
    brand: { findUnique: ReturnType<typeof vi.fn> };
  };
  let dealsService: DealsService;
  let service: ProposalsService;

  beforeEach(() => {
    prisma = {
      dealProposal: {
        updateMany: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      deal: { update: vi.fn() },
      brand: { findUnique: vi.fn().mockResolvedValue({ ownerId: 'owner-1' }) },
    };
    dealsService = new DealsService(prisma as unknown as PrismaService);
    vi.spyOn(dealsService, 'findEntityOrThrow').mockResolvedValue(
      buildDeal() as never,
    );
    service = new ProposalsService(
      prisma as unknown as PrismaService,
      dealsService,
    );
  });

  describe('create', () => {
    it('rejects proposals once the deal is no longer negotiating', async () => {
      vi.spyOn(dealsService, 'findEntityOrThrow').mockResolvedValue(
        buildDeal({ status: 'ACTIVE' }) as never,
      );

      await expect(
        service.create('deal-1', buildUser({ id: 'owner-1' }), {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('supersedes prior pending proposals and creates a new one', async () => {
      prisma.dealProposal.create.mockResolvedValue(buildProposal());

      await service.create('deal-1', buildUser({ id: 'owner-1' }), {
        totalValue: 1000,
      });

      expect(prisma.dealProposal.updateMany).toHaveBeenCalledWith({
        where: { dealId: 'deal-1', status: 'PENDING' },
        data: { status: 'SUPERSEDED', respondedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('accept', () => {
    it('rejects the proposer accepting their own proposal', async () => {
      prisma.dealProposal.findUnique.mockResolvedValue(buildProposal());

      await expect(
        service.accept('deal-1', 'proposal-1', buildUser({ id: 'owner-1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects deciding a non-pending proposal', async () => {
      prisma.dealProposal.findUnique.mockResolvedValue(
        buildProposal({ status: 'REJECTED' }),
      );

      await expect(
        service.accept('deal-1', 'proposal-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('activates the deal with the accepted proposal terms', async () => {
      prisma.dealProposal.findUnique.mockResolvedValue(buildProposal());
      prisma.dealProposal.update.mockResolvedValue(
        buildProposal({ status: 'ACCEPTED', respondedAt: new Date() }),
      );

      const result = await service.accept('deal-1', 'proposal-1', buildUser());

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          totalValue: 1000,
          revenueSplitBrand: 30,
          revenueSplitCreator: 70,
        }) as Record<string, unknown>,
      });
      expect(result.status).toBe('ACCEPTED');
    });
  });

  describe('reject', () => {
    it('marks the proposal as rejected without activating the deal', async () => {
      prisma.dealProposal.findUnique.mockResolvedValue(buildProposal());
      prisma.dealProposal.update.mockResolvedValue(
        buildProposal({ status: 'REJECTED', respondedAt: new Date() }),
      );

      const result = await service.reject('deal-1', 'proposal-1', buildUser());

      expect(prisma.deal.update).not.toHaveBeenCalled();
      expect(result.status).toBe('REJECTED');
    });
  });
});
