import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReindexController } from './reindex.controller';
import { ReindexService } from './reindex.service';

describe('ReindexController', () => {
  let reindexService: { reindexAll: ReturnType<typeof vi.fn> };
  let controller: ReindexController;

  beforeEach(() => {
    reindexService = { reindexAll: vi.fn().mockResolvedValue(undefined) };
    controller = new ReindexController(
      reindexService as unknown as ReindexService,
    );
  });

  describe('reindexAll', () => {
    it('triggers a full reindex and confirms completion', async () => {
      const result = await controller.reindexAll();

      expect(reindexService.reindexAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Reindex complete' });
    });
  });
});
