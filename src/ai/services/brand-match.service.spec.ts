import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandMatchService } from './brand-match.service';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';

describe('BrandMatchService', () => {
  let prisma: {
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    deal: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    application: { findMany: ReturnType<typeof vi.fn> };
  };
  let cacheService: { getOrCompute: ReturnType<typeof vi.fn> };
  let promptService: { brandMatchNarrative: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: BrandMatchService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn(), findMany: vi.fn() },
      deal: { findMany: vi.fn(), count: vi.fn() },
      application: { findMany: vi.fn() },
    };
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
      brandMatchNarrative: vi
        .fn()
        .mockResolvedValue({ text: 'Great fit.', generatedByAi: true }),
    };
    configService = { get: vi.fn().mockReturnValue(900) };
    service = new BrandMatchService(
      prisma as unknown as PrismaService,
      cacheService as unknown as CacheService,
      promptService as unknown as PromptService,
      configService as unknown as ConfigService,
    );
  });

  describe('getMatch', () => {
    it('throws NotFoundException for a missing brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.getMatch('brand-1', {
          id: 'creator-1',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scores full overlap and track record at 100', async () => {
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        name: 'Acme',
        categories: [{ id: 'cat-1', name: 'Streetwear' }],
      });
      prisma.deal.findMany.mockResolvedValue([{ brandId: 'brand-2' }]);
      prisma.application.findMany.mockResolvedValue([]);
      prisma.brand.findMany.mockResolvedValue([
        {
          id: 'brand-2',
          categories: [{ id: 'cat-1', name: 'Streetwear' }],
        },
      ]);
      prisma.deal.count.mockResolvedValue(5);

      const result = await service.getMatch('brand-1', {
        id: 'creator-1',
        roles: ['USER'],
      } as never);

      expect(result.score).toBe(100);
      expect(result.overlapCategories).toEqual(['Streetwear']);
      expect(result.narrative).toBe('Great fit.');
      expect(result.cached).toBe(false);
    });

    it('scores 0 with no prior brand history', async () => {
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        name: 'Acme',
        categories: [{ id: 'cat-1', name: 'Streetwear' }],
      });
      prisma.deal.findMany.mockResolvedValue([]);
      prisma.application.findMany.mockResolvedValue([]);
      prisma.deal.count.mockResolvedValue(0);

      const result = await service.getMatch('brand-1', {
        id: 'creator-1',
        roles: ['USER'],
      } as never);

      expect(result.score).toBe(0);
      expect(result.overlapCategories).toEqual([]);
      expect(prisma.brand.findMany).not.toHaveBeenCalled();
    });
  });
});
