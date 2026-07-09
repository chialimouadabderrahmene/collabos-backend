import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { NotificationsController } from './notifications.controller';
import { ApplicationsService } from './services/applications.service';
import { NotificationsService } from './services/notifications.service';

@Module({
  controllers: [ApplicationsController, NotificationsController],
  providers: [ApplicationsService, NotificationsService],
  exports: [ApplicationsService, NotificationsService],
})
export class ApplicationsModule {}
