import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let searchService: { search: ReturnType<typeof vi.fn> };
  let controller: SearchController;

  beforeEach(() => {
    searchService = {
      search: vi.fn().mockResolvedValue({ found: 0, page: 1, hits: [] }),
    };
    controller = new SearchController(
      searchService as unknown as SearchService,
    );
  });

  describe('search', () => {
    it('delegates to the search service', async () => {
      const query = { collection: 'products', q: 'shirt', page: 1, limit: 20 };

      const result = await controller.search(query);

      expect(searchService.search).toHaveBeenCalledWith(query);
      expect(result).toEqual({ found: 0, page: 1, hits: [] });
    });
  });
});
