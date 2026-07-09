import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  REINDEX_JOB,
  REINDEX_REPEAT_JOB_ID,
  SEARCH_REINDEX_QUEUE,
} from './reindex-queue.constant';

@Injectable()
export class ReindexSchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(SEARCH_REINDEX_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const every =
      this.configService.get<number>('typesense.reindexIntervalMs') ?? 300000;

    await this.queue.add(
      REINDEX_JOB,
      {},
      { jobId: REINDEX_REPEAT_JOB_ID, repeat: { every } },
    );
  }
}
