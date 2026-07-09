import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service';
import { TypesenseService } from './typesense.service';

describe('SearchService', () => {
  let typesenseService: {
    isConfigured: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
  let service: SearchService;

  beforeEach(() => {
    typesenseService = {
      isConfigured: vi.fn().mockReturnValue(true),
      search: vi.fn(),
    };
    service = new SearchService(
      typesenseService as unknown as TypesenseService,
    );
  });

  describe('search', () => {
    it('throws ServiceUnavailableException when search is not configured', async () => {
      typesenseService.isConfigured.mockReturnValue(false);

      await expect(
        service.search({
          collection: 'products',
          q: 'shirt',
          page: 1,
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('maps Typesense hits into the response shape', async () => {
      typesenseService.search.mockResolvedValue({
        found: 1,
        hits: [{ document: { id: 'product-1', name: 'Tee' } }],
      });

      const result = await service.search({
        collection: 'products',
        q: 'shirt',
        page: 1,
        limit: 20,
      });

      expect(typesenseService.search).toHaveBeenCalledWith(
        'products',
        'shirt',
        'name,description',
        1,
        20,
      );
      expect(result).toEqual({
        found: 1,
        page: 1,
        hits: [{ id: 'product-1', document: { id: 'product-1', name: 'Tee' } }],
      });
    });

    it('defaults found and hits to empty when Typesense omits them', async () => {
      typesenseService.search.mockResolvedValue({});

      const result = await service.search({
        collection: 'brands',
        q: 'acme',
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({ found: 0, page: 1, hits: [] });
    });
  });
});
