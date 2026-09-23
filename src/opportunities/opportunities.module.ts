import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AiModule } from '../ai/ai.module';
import { BrandsModule } from '../brands/brands.module';
import { EventsModule } from '../events/events.module';
import { StorageModule } from '../storage/storage.module';
import { OpportunityPublishedHandler } from './events/opportunity-published.handler';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunityAiController } from './opportunity-ai.controller';
import { OpportunityAssetsController } from './opportunity-assets.controller';
import { OpportunityContentController } from './opportunity-content.controller';
import { OpportunityShareLinksController } from './opportunity-share-links.controller';
import { AssetUrlService } from './services/asset-url.service';
import { OpportunitiesService } from './services/opportunities.service';
import { OpportunityAccessService } from './services/opportunity-access.service';
import { OpportunityActivityService } from './services/opportunity-activity.service';
import { OpportunityAiService } from './services/opportunity-ai.service';
import { OpportunityAssetsService } from './services/opportunity-assets.service';
import { OpportunityDocumentService } from './services/opportunity-document.service';
import { OpportunityDraftService } from './services/opportunity-draft.service';
import { OpportunityMembersService } from './services/opportunity-members.service';
import { OpportunityPublishService } from './services/opportunity-publish.service';
import { OpportunityShareLinksService } from './services/opportunity-share-links.service';
import { ShareController } from './share.controller';

/**
 * Opportunity Creation Studio: Opportunity → Draft → Assets → AI suggestions
 * → Publish (immutable versions) → Private share links.
 */
@Module({
  imports: [
    BrandsModule,
    StorageModule,
    EventsModule,
    AiModule,
    // Enforce the upload size limit while streaming (memory storage is the
    // default), so oversized files are rejected with 413 before being fully
    // buffered.
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        limits: {
          files: 1,
          fileSize:
            (configService.get<number>('opportunities.assetMaxSizeMb') ?? 15) *
            1024 *
            1024,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    OpportunitiesController,
    OpportunityContentController,
    OpportunityAssetsController,
    OpportunityShareLinksController,
    OpportunityAiController,
    ShareController,
  ],
  providers: [
    OpportunityAccessService,
    OpportunityActivityService,
    OpportunityDocumentService,
    AssetUrlService,
    OpportunitiesService,
    OpportunityMembersService,
    OpportunityDraftService,
    OpportunityAssetsService,
    OpportunityPublishService,
    OpportunityShareLinksService,
    OpportunityAiService,
    OpportunityPublishedHandler,
  ],
})
export class OpportunitiesModule {}
