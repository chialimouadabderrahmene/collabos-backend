import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from './cache.service';
import { LaunchReadinessService } from './launch-readiness.service';
import { PromptService } from './prompt.service';

function buildDrop(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'drop-1',
    title: 'Fall Drop',
    status: 'SCHEDULED',
    publishAt: new Date(),
    brand: { id: 'brand-1', ownerId: 'owner-1' },
    page: { id: 'page-1' },
    seo: { id: 'seo-1' },
    media: [{ id: 'media-1' }],
    products: [{ id: 'product-1' }],
    ...overrides,
  };
}

describe('LaunchReadinessService', () => {
  let prisma: { drop: { findUnique: ReturnType<typeof vi.fn> } };
  let cacheService: { getOrCompute: ReturnType<typeof vi.fn> };
  let promptService: { launchReadinessNarrative: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: LaunchReadinessService;

  beforeEach(() => {
    prisma = { drop: { findUnique: vi.fn() } };
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
      launchReadinessNarrative: vi
        .fn()
        .mockResolvedValue({ text: 'Ready to launch.', generatedByAi: true }),
    };
    configService = { get: vi.fn().mockReturnValue(900) };
    service = new LaunchReadinessService(
      prisma as unknown as PrismaService,
      cacheService as unknown as CacheService,
      promptService as unknown as PromptService,
      configService as unknown as ConfigService,
    );
  });

  describe('getReadiness', () => {
    it('throws NotFoundException for a missing drop', async () => {
      prisma.drop.findUnique.mockResolvedValue(null);

      await expect(
        service.getReadiness('drop-1', {
          id: 'owner-1',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a user who does not own the drop brand', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop());

      await expect(
        service.getReadiness('drop-1', {
          id: 'stranger',
          roles: ['USER'],
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('scores a fully-ready drop at 100 with no blockers', async () => {
      prisma.drop.findUnique.mockResolvedValue(buildDrop());

      const result = await service.getReadiness('drop-1', {
        id: 'owner-1',
        roles: ['USER'],
      } as never);

      expect(result.score).toBe(100);
      expect(result.blockers).toEqual([]);
      expect(result.narrative).toBe('Ready to launch.');
    });

    it('flags missing media and products as blockers', async () => {
      prisma.drop.findUnique.mockResolvedValue(
        buildDrop({ media: [], products: [] }),
      );

      const result = await service.getReadiness('drop-1', {
        id: 'owner-1',
        roles: ['USER'],
      } as never);

      expect(result.blockers).toContain('No media has been uploaded');
      expect(result.blockers).toContain('No products are attached');
    });
  });
});
