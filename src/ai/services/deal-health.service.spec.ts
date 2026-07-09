import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DealHealthService } from './deal-health.service';
import { PromptService } from './prompt.service';
import { CacheService } from './cache.service';

function buildDeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'deal-1',
    title: 'Summer Collab',
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    creatorId: 'creator-1',
    brand: { id: 'brand-1', ownerId: 'owner-1' },
    milestones: [],
    ...overrides,
  };
}

describe('DealHealthService', () => {
  let prisma: { deal: { findUnique: ReturnType<typeof vi.fn> } };
  let cacheService: { getOrCompute: ReturnType<typeof vi.fn> };
  let promptService: { dealHealthNarrative: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: DealHealthService;

  beforeEach(() => {
    prisma = { deal: { findUnique: vi.fn() } };
    cacheService = {
      getOrCompute: vi.fn(
        async (
          _key: string,
          _ttl: number,
          compute: () => Promise<unknown>,
        ) => ({
          value: await compute(),
          cached: false,
        }),
      ),
    };
    promptService = {
      dealHealthNarrative: vi
        .fn()
        .mockResolvedValue({ text: 'Looking healthy.', generatedByAi: true }),
    };
    configService = { get: vi.fn().mockReturnValue(900) };
    service = new DealHealthService(
      prisma as unknown as PrismaService,
      cacheService as unknown as CacheService,
      promptService as unknown as PromptService,
      configService as unknown as ConfigService,
    );
  });

  describe('getHealth', () => {
    it('throws NotFoundException for a missing deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.getHealth('deal-1', {
          id: 'creator-1',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a user unrelated to the deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());

      await expect(
        service.getHealth('deal-1', {
          id: 'stranger',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns a scored, narrated, cache-wrapped health assessment for the creator', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ milestones: [{ dueDate: future, isCompleted: true }] }),
      );

      const result = await service.getHealth('deal-1', {
        id: 'creator-1',
        roles: ['USER'],
      } as never);

      expect(result.dealId).toBe('deal-1');
      expect(result.score).toBe(100);
      expect(result.riskFactors).toEqual([]);
      expect(result.narrative).toBe('Looking healthy.');
      expect(result.generatedByAi).toBe(true);
      expect(result.cached).toBe(false);
      expect(cacheService.getOrCompute).toHaveBeenCalledWith(
        'deal-health:deal-1',
        900,
        expect.any(Function),
      );
    });

    it('allows the brand owner to view the deal health', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());

      await expect(
        service.getHealth('deal-1', {
          id: 'owner-1',
          roles: ['USER'],
        } as never),
      ).resolves.toBeDefined();
    });

    it('surfaces overdue-milestone risk factors in the score', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ milestones: [{ dueDate: past, isCompleted: false }] }),
      );

      const result = await service.getHealth('deal-1', {
        id: 'creator-1',
        roles: ['USER'],
      } as never);

      expect(result.riskFactors).toContain('1 milestone(s) overdue');
      expect(promptService.dealHealthNarrative).toHaveBeenCalledWith(
        expect.objectContaining({ dealTitle: 'Summer Collab' }),
      );
    });
  });
});
