import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { ConversationsService } from '../services/conversations.service';
import { MessagesService } from '../services/messages.service';
import { PresenceService } from '../services/presence.service';
import {
  WsAuthenticatedUser,
  WsAuthService,
} from '../services/ws-auth.service';
import {
  MessageResponse,
  SeenResponse,
} from '../types/messaging-response.types';

type SocketData = { user?: WsAuthenticatedUser };
type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

const conversationRoom = (conversationId: string): string =>
  `conversation:${conversationId}`;

@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly presenceService: PresenceService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.wsAuthService.authenticate(socket);
      socket.data.user = user;

      const conversationIds =
        await this.conversationsService.listConversationIdsForUser(user.id);
      for (const conversationId of conversationIds) {
        await socket.join(conversationRoom(conversationId));
      }

      const connectionCount = await this.presenceService.addConnection(
        user.id,
        socket.id,
      );

      if (connectionCount === 1) {
        for (const conversationId of conversationIds) {
          this.server
            .to(conversationRoom(conversationId))
            .emit('userOnline', { userId: user.id });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Rejected socket connection: ${(error as Error).message}`,
      );
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const user = socket.data.user;
    if (!user) {
      return;
    }

    const remaining = await this.presenceService.removeConnection(
      user.id,
      socket.id,
    );

    if (remaining === 0) {
      const conversationIds =
        await this.conversationsService.listConversationIdsForUser(user.id);
      for (const conversationId of conversationIds) {
        this.server
          .to(conversationRoom(conversationId))
          .emit('userOffline', { userId: user.id });
      }
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const user = this.requireUser(socket);
    await this.conversationsService.assertParticipantById(
      data.conversationId,
      user.id,
    );
    await socket.join(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; body?: string },
  ): Promise<MessageResponse> {
    const user = this.requireUser(socket);
    const message = await this.messagesService.create(
      data.conversationId,
      user.id,
      { body: data.body },
    );

    this.broadcastNewMessage(data.conversationId, message);
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ): void {
    const user = this.requireUser(socket);
    socket.to(conversationRoom(data.conversationId)).emit('userTyping', {
      conversationId: data.conversationId,
      userId: user.id,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('markSeen')
  async handleMarkSeen(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): Promise<SeenResponse> {
    const user = this.requireUser(socket);
    const seen = await this.conversationsService.markSeen(
      data.conversationId,
      user.id,
    );

    this.broadcastSeen(seen);
    return seen;
  }

  broadcastNewMessage(conversationId: string, message: MessageResponse): void {
    this.server
      .to(conversationRoom(conversationId))
      .emit('newMessage', message);
  }

  broadcastSeen(seen: SeenResponse): void {
    this.server
      .to(conversationRoom(seen.conversationId))
      .emit('messagesSeen', seen);
  }

  private requireUser(socket: AuthenticatedSocket): WsAuthenticatedUser {
    const user = socket.data.user;
    if (!user) {
      throw new WsException('Not authenticated');
    }
    return user;
  }
}
