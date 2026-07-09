import { InjectQueue } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS } from '../../common/queue/job-options.constant';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DELIVER_NOTIFICATION_JOB,
  NOTIFICATIONS_QUEUE,
} from '../constants/notifications-queue.constant';
import { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { toNotificationResponse } from '../mappers/notification.mapper';
import {
  NotificationResponse,
  PaginatedNotificationsResponse,
} from '../types/notification-response.types';
import { PreferencesService } from './preferences.service';
import { RenderedTemplate, TemplatesService } from './templates.service';

const DEFAULT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.PUSH,
  NotificationChannel.EMAIL,
  NotificationChannel.IN_APP,
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly templatesService: TemplatesService,
    private readonly preferencesService: PreferencesService,
  ) {}

  async notify(params: SendNotificationDto): Promise<NotificationResponse> {
    const template = await this.templatesService.getActiveOrThrow(
      params.templateKey,
    );
    const preferences = await this.preferencesService.getOrCreate(
      params.userId,
    );
    const rendered = this.templatesService.render(
      template,
      params.variables ?? {},
    );

    const title = rendered.pushTitle ?? template.name;
    const message = rendered.inAppBody ?? rendered.pushBody ?? '';

    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.GENERIC,
        templateKey: template.key,
        title,
        message,
        metadata: params.variables
          ? (params.variables as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const channels = Array.from(new Set(params.channels ?? DEFAULT_CHANNELS));

    for (const channel of channels) {
      const enabled = this.isChannelEnabled(channel, preferences);
      const { subject, body } = this.contentFor(channel, rendered, {
        title,
        message,
      });

      const delivery = await this.prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel,
          status: enabled ? DeliveryStatus.PENDING : DeliveryStatus.SKIPPED,
          subject,
          body,
        },
      });

      if (enabled) {
        await this.queue.add(
          DELIVER_NOTIFICATION_JOB,
          { deliveryId: delivery.id },
          { ...DEFAULT_JOB_OPTIONS, jobId: delivery.id },
        );
      }
    }

    return toNotificationResponse(notification);
  }

  async findMine(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: data.map((notification) => toNotificationResponse(notification)),
      total,
      page: query.page,
      limit: query.limit,
      unreadCount,
    };
  }

  async markRead(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return toNotificationResponse(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: result.count };
  }

  private isChannelEnabled(
    channel: NotificationChannel,
    preferences: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      inAppNotifications: boolean;
    },
  ): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return preferences.emailNotifications;
      case NotificationChannel.PUSH:
        return preferences.pushNotifications;
      case NotificationChannel.IN_APP:
        return preferences.inAppNotifications;
    }
  }

  private contentFor(
    channel: NotificationChannel,
    rendered: RenderedTemplate,
    fallback: { title: string; message: string },
  ): { subject: string | null; body: string | null } {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return {
          subject: rendered.emailSubject ?? fallback.title,
          body: rendered.emailBody ?? fallback.message,
        };
      case NotificationChannel.PUSH:
        return {
          subject: rendered.pushTitle ?? fallback.title,
          body: rendered.pushBody ?? fallback.message,
        };
      case NotificationChannel.IN_APP:
        return {
          subject: null,
          body: rendered.inAppBody ?? fallback.message,
        };
    }
  }
}
