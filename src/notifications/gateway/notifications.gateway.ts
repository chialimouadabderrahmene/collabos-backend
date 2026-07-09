import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { NotificationResponse } from '../types/notification-response.types';
import { WsAuthService } from './ws-auth.service';

type SocketData = { userId?: string };
type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export const userRoom = (userId: string): string => `user:${userId}`;

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsAuthService: WsAuthService) {}

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.wsAuthService.authenticate(socket);
      socket.data.userId = user.id;
      await socket.join(userRoom(user.id));
    } catch (error) {
      this.logger.warn(
        `Rejected socket connection: ${(error as Error).message}`,
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Socket.IO removes the socket from all rooms automatically on disconnect.
  }

  emitToUser(userId: string, notification: NotificationResponse): void {
    this.server.to(userRoom(userId)).emit('notification', notification);
  }
}
