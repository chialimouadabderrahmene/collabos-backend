import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DROPS_QUEUE, DropsService } from './drops.service';

interface PublishDropJobData {
  dropId: string;
}

@Processor(DROPS_QUEUE)
export class DropsPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(DropsPublishProcessor.name);

  constructor(private readonly dropsService: DropsService) {
    super();
  }

  async process(job: Job<PublishDropJobData>): Promise<void> {
    if (job.name !== 'publish-drop') {
      return;
    }

    await this.dropsService.publishScheduled(job.data.dropId);
    this.logger.log(`Auto-published scheduled drop ${job.data.dropId}`);
  }
}
