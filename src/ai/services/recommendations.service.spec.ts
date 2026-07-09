import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  let prisma: {
    deal: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    application: { findMany: ReturnType<typeof vi.fn> };
    brand: { findMany: ReturnType<typeof vi.fn> };
    brief: { findMany: ReturnType<typeof vi.fn> };
  };
  let cacheService: { getOrCompute: ReturnType<typeof vi.fn> };
  let promptService: { recommendationReason: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: RecommendationsService;

  beforeEach(() => {
    prisma = {
      deal: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      application: {
        findMany: vi.fn((args: { select: Record<string, unknown> }) => {
          if ('briefId' in args.select) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      },
      brand: { findMany: vi.fn().mockResolvedValue([]) },
      brief: { findMany: vi.fn().mockResolvedValue([]) },
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
      recommendationReason: vi
        .fn()
        .mockResolvedValue({ text: 'Great opportunity.', generatedByAi: true }),
    };
    configService = { get: vi.fn().mockReturnValue(900) };
    service = new RecommendationsService(
      prisma as unknown as PrismaService,
      cacheService as unknown as CacheService,
      promptService as unknown as PromptService,
      configService as unknown as ConfigService,
    );
  });

  describe('getRecommendations', () => {
    it('returns an empty list when there are no open briefs', async () => {
      const result = await service.getRecommendations(
        { id: 'creator-1', roles: ['USER'] } as never,
        { limit: 5 },
      );

      expect(result.data).toEqual([]);
      expect(result.cached).toBe(false);
    });

    it('excludes briefs the creator already applied to', async () => {
      prisma.application.findMany.mockImplementation(
        (args: { select: Record<string, unknown> }) => {
          if ('briefId' in args.select) {
            return Promise.resolve([{ briefId: 'brief-1' }]);
          }
          return Promise.resolve([]);
        },
      );
      prisma.brief.findMany.mockResolvedValue([
        {
          id: 'brief-1',
          title: 'Already applied',
          brandId: 'brand-1',
          brand: { id: 'brand-1', name: 'Acme', categories: [] },
        },
      ]);

      const result = await service.getRecommendations(
        { id: 'creator-1', roles: ['USER'] } as never,
        { limit: 5 },
      );

      expect(result.data).toEqual([]);
    });

    it('ranks candidate briefs by score and returns narrated reasons', async () => {
      prisma.brief.findMany.mockResolvedValue([
        {
          id: 'brief-1',
          title: 'Look book shoot',
          brandId: 'brand-1',
          brand: {
            id: 'brand-1',
            name: 'Acme',
            categories: [{ id: 'cat-1', name: 'Streetwear' }],
          },
        },
      ]);
      prisma.deal.findMany.mockResolvedValue([{ brandId: 'brand-2' }]);
      prisma.brand.findMany.mockResolvedValue([
        {
          id: 'brand-2',
          categories: [{ id: 'cat-1', name: 'Streetwear' }],
        },
      ]);
      prisma.deal.count.mockResolvedValue(3);

      const result = await service.getRecommendations(
        { id: 'creator-1', roles: ['USER'] } as never,
        { limit: 5 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          briefId: 'brief-1',
          brandName: 'Acme',
          overlapCategories: ['Streetwear'],
          reason: 'Great opportunity.',
          generatedByAi: true,
        }),
      );
    });

    it('respects the limit', async () => {
      prisma.brief.findMany.mockResolvedValue([
        {
          id: 'brief-1',
          title: 'A',
          brandId: 'brand-1',
          brand: { id: 'brand-1', name: 'Acme', categories: [] },
        },
        {
          id: 'brief-2',
          title: 'B',
          brandId: 'brand-2',
          brand: { id: 'brand-2', name: 'Beta', categories: [] },
        },
      ]);

      const result = await service.getRecommendations(
        { id: 'creator-1', roles: ['USER'] } as never,
        { limit: 1 },
      );

      expect(result.data).toHaveLength(1);
    });
  });
});
