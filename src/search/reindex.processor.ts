import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { REINDEX_JOB, SEARCH_REINDEX_QUEUE } from './reindex-queue.constant';
import { ReindexService } from './reindex.service';

@Processor(SEARCH_REINDEX_QUEUE)
export class ReindexProcessor extends WorkerHost {
  constructor(private readonly reindexService: ReindexService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== REINDEX_JOB) {
      return;
    }

    await this.reindexService.reindexIncremental();
  }
}
