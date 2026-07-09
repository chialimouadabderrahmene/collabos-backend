import { Module } from '@nestjs/common';
import { MessagingGateway } from './gateway/messaging.gateway';
import { MessagingController } from './messaging.controller';
import { AttachmentStorageService } from './services/attachment-storage.service';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { PresenceService } from './services/presence.service';
import { WsAuthService } from './services/ws-auth.service';

@Module({
  controllers: [MessagingController],
  providers: [
    ConversationsService,
    MessagesService,
    AttachmentStorageService,
    PresenceService,
    WsAuthService,
    MessagingGateway,
  ],
  exports: [ConversationsService, MessagesService],
})
export class MessagingModule {}
