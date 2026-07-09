import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReindexProcessor } from './reindex.processor';
import { ReindexService } from './reindex.service';

describe('ReindexProcessor', () => {
  let reindexService: { reindexIncremental: ReturnType<typeof vi.fn> };
  let processor: ReindexProcessor;

  beforeEach(() => {
    reindexService = {
      reindexIncremental: vi.fn().mockResolvedValue(undefined),
    };
    processor = new ReindexProcessor(
      reindexService as unknown as ReindexService,
    );
  });

  describe('process', () => {
    it('runs the incremental reindex for the scheduled job', async () => {
      await processor.process({
        name: 'reindex-incremental',
        data: {},
      } as never);

      expect(reindexService.reindexIncremental).toHaveBeenCalledTimes(1);
    });

    it('ignores unrelated job names', async () => {
      await processor.process({ name: 'other-job', data: {} } as never);

      expect(reindexService.reindexIncremental).not.toHaveBeenCalled();
    });
  });
});
