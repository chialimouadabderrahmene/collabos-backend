import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATIONS_QUEUE } from './constants/notifications-queue.constant';
import { NotificationsGateway } from './gateway/notifications.gateway';
import { WsAuthService } from './gateway/ws-auth.service';
import { NotificationsController } from './notifications.controller';
import { PreferencesController } from './preferences.controller';
import { PushController } from './push.controller';
import { NotificationsProcessor } from './services/notifications.processor';
import { NotificationsService } from './services/notifications.service';
import { PreferencesService } from './services/preferences.service';
import { PushProviderService } from './services/push-provider.service';
import { PushTokensService } from './services/push-tokens.service';
import { TemplatesService } from './services/templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [
    NotificationsController,
    PreferencesController,
    PushController,
    TemplatesController,
  ],
  providers: [
    NotificationsService,
    PreferencesService,
    PushTokensService,
    TemplatesService,
    PushProviderService,
    NotificationsGateway,
    WsAuthService,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
