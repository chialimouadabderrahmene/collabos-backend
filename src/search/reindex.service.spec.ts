import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ReindexService } from './reindex.service';
import { TypesenseService } from './typesense.service';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'product-1',
    name: 'Tee',
    description: 'A shirt',
    slug: 'tee',
    brandId: 'brand-1',
    price: 20,
    isActive: true,
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ReindexService', () => {
  let prisma: {
    product: { findMany: ReturnType<typeof vi.fn> };
    brand: { findMany: ReturnType<typeof vi.fn> };
    drop: { findMany: ReturnType<typeof vi.fn> };
    searchSyncState: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };
  let typesenseService: {
    isConfigured: ReturnType<typeof vi.fn>;
    ensureCollection: ReturnType<typeof vi.fn>;
    upsertDocument: ReturnType<typeof vi.fn>;
  };
  let service: ReindexService;

  beforeEach(() => {
    prisma = {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      brand: { findMany: vi.fn().mockResolvedValue([]) },
      drop: { findMany: vi.fn().mockResolvedValue([]) },
      searchSyncState: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    };
    typesenseService = {
      isConfigured: vi.fn().mockReturnValue(true),
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertDocument: vi.fn().mockResolvedValue(undefined),
    };
    service = new ReindexService(
      prisma as unknown as PrismaService,
      typesenseService as unknown as TypesenseService,
    );
  });

  describe('reindexAll', () => {
    it('does nothing when search is not configured', async () => {
      typesenseService.isConfigured.mockReturnValue(false);

      await service.reindexAll();

      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('ensures every collection and syncs from the epoch', async () => {
      await service.reindexAll();

      expect(typesenseService.ensureCollection).toHaveBeenCalledTimes(3);
      const call = prisma.product.findMany.mock.calls[0][0] as {
        where: { updatedAt: { gte: Date } };
      };
      expect(call.where.updatedAt.gte).toEqual(new Date(0));
    });
  });

  describe('reindexIncremental', () => {
    it('does nothing when search is not configured', async () => {
      typesenseService.isConfigured.mockReturnValue(false);

      await service.reindexIncremental();

      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('uses the stored cursor and upserts changed products', async () => {
      prisma.searchSyncState.findUnique.mockResolvedValue({
        collection: 'products',
        lastSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      prisma.product.findMany.mockResolvedValue([buildProduct()]);

      await service.reindexIncremental();

      expect(typesenseService.upsertDocument).toHaveBeenCalledWith(
        'products',
        expect.objectContaining({ id: 'product-1', name: 'Tee' }),
      );
      expect(prisma.searchSyncState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { collection: 'products' } }),
      );
    });

    it('defaults to the epoch when no cursor has been stored yet', async () => {
      await service.reindexIncremental();

      const call = prisma.product.findMany.mock.calls[0][0] as {
        where: { updatedAt: { gte: Date } };
      };
      expect(call.where.updatedAt.gte).toEqual(new Date(0));
    });
  });
});
