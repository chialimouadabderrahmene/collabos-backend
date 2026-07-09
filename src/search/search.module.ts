import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SEARCH_REINDEX_QUEUE } from './reindex-queue.constant';
import { ReindexSchedulerService } from './reindex-scheduler.service';
import { ReindexController } from './reindex.controller';
import { ReindexProcessor } from './reindex.processor';
import { ReindexService } from './reindex.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TypesenseService } from './typesense.service';

@Module({
  imports: [BullModule.registerQueue({ name: SEARCH_REINDEX_QUEUE })],
  controllers: [SearchController, ReindexController],
  providers: [
    TypesenseService,
    SearchService,
    ReindexService,
    ReindexSchedulerService,
    ReindexProcessor,
  ],
})
export class SearchModule {}
