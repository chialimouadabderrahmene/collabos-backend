import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReindexSchedulerService } from './reindex-scheduler.service';
import { REINDEX_REPEAT_JOB_ID } from './reindex-queue.constant';

describe('ReindexSchedulerService', () => {
  let queue: { add: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: ReindexSchedulerService;

  beforeEach(() => {
    queue = { add: vi.fn().mockResolvedValue(undefined) };
    configService = { get: vi.fn().mockReturnValue(300000) };
    service = new ReindexSchedulerService(
      queue as never,
      configService as unknown as ConfigService,
    );
  });

  describe('onModuleInit', () => {
    it('registers the repeatable reindex job using the configured interval', async () => {
      await service.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        'reindex-incremental',
        {},
        { jobId: REINDEX_REPEAT_JOB_ID, repeat: { every: 300000 } },
      );
    });
  });
});
