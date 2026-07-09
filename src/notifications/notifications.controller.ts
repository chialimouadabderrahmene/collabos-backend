import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './services/notifications.service';
import {
  MessageResponse,
  NotificationResponse,
  PaginatedNotificationsResponse,
} from './types/notification-response.types';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Trigger a templated notification for a user (admin only)',
  })
  @ApiResponse({ status: 201, type: NotificationResponse })
  send(@Body() dto: SendNotificationDto): Promise<NotificationResponse> {
    return this.notificationsService.notify(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my in-app notifications' })
  @ApiResponse({ status: 200, type: PaginatedNotificationsResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.findMine(user.id, query);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const { updated } = await this.notificationsService.markAllRead(user.id);
    return { message: `Marked ${updated} notification(s) as read` };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, type: NotificationResponse })
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markRead(id, user.id);
  }
}
