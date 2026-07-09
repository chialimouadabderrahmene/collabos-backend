import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DropsController } from './drops.controller';
import { DROPS_QUEUE } from './services/drops.service';
import { DropMediaStorageService } from './services/drop-media-storage.service';
import { DropMediaService } from './services/drop-media.service';
import { DropPageService } from './services/drop-page.service';
import { DropProductsService } from './services/drop-products.service';
import { DropSeoService } from './services/drop-seo.service';
import { DropsPublishProcessor } from './services/drops-publish.processor';
import { DropsService } from './services/drops.service';
import { OptionalAuthService } from './services/optional-auth.service';

@Module({
  imports: [BullModule.registerQueue({ name: DROPS_QUEUE })],
  controllers: [DropsController],
  providers: [
    DropsService,
    DropPageService,
    DropSeoService,
    DropMediaService,
    DropMediaStorageService,
    DropProductsService,
    DropsPublishProcessor,
    OptionalAuthService,
  ],
  exports: [DropsService],
})
export class DropsModule {}
