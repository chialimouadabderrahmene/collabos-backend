import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from './cache.service';
import { PromptService } from './prompt.service';
import { RevenuePredictionService } from './revenue-prediction.service';

describe('RevenuePredictionService', () => {
  let prisma: {
    brand: { findUnique: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let cacheService: { getOrCompute: ReturnType<typeof vi.fn> };
  let promptService: { revenuePredictionNarrative: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: RevenuePredictionService;

  beforeEach(() => {
    prisma = {
      brand: { findUnique: vi.fn() },
      $queryRaw: vi.fn(),
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
      revenuePredictionNarrative: vi
        .fn()
        .mockResolvedValue({ text: 'Trending up.', generatedByAi: true }),
    };
    configService = { get: vi.fn().mockReturnValue(900) };
    service = new RevenuePredictionService(
      prisma as unknown as PrismaService,
      cacheService as unknown as CacheService,
      promptService as unknown as PromptService,
      configService as unknown as ConfigService,
    );
  });

  describe('getPrediction', () => {
    it('throws NotFoundException for a missing brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.getPrediction('brand-1', { months: 3 }, {
          id: 'owner-1',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a user who does not own the brand', async () => {
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
        name: 'Acme',
      });

      await expect(
        service.getPrediction('brand-1', { months: 3 }, {
          id: 'stranger',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('builds history and predicted points from the monthly query', async () => {
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
        name: 'Acme',
      });
      prisma.$queryRaw.mockResolvedValue([
        { bucket: new Date('2026-01-01'), revenue: 100 },
        { bucket: new Date('2026-02-01'), revenue: 200 },
      ]);

      const result = await service.getPrediction('brand-1', { months: 2 }, {
        id: 'owner-1',
        roles: ['USER'],
      } as never);

      expect(result.history).toEqual([
        { period: '2026-01', amount: 100 },
        { period: '2026-02', amount: 200 },
      ]);
      expect(result.trend).toBe('up');
      expect(result.predicted).toHaveLength(2);
      expect(result.narrative).toBe('Trending up.');
      expect(result.cached).toBe(false);
    });

    it('handles a brand with no order history', async () => {
      prisma.brand.findUnique.mockResolvedValue({
        id: 'brand-1',
        ownerId: 'owner-1',
        name: 'Acme',
      });
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getPrediction('brand-1', { months: 1 }, {
        id: 'owner-1',
        roles: ['USER'],
      } as never);

      expect(result.history).toEqual([]);
      expect(result.trend).toBe('flat');
      expect(result.predicted).toHaveLength(1);
      expect(result.predicted[0].amount).toBe(0);
      expect(typeof result.predicted[0].period).toBe('string');
    });
  });
});
