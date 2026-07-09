import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  DeliveryStatus,
  Notification,
  NotificationChannel,
  NotificationDelivery,
} from '@prisma/client';
import { Job } from 'bullmq';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DeliverNotificationJobData,
  DELIVER_NOTIFICATION_JOB,
  NOTIFICATIONS_QUEUE,
} from '../constants/notifications-queue.constant';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { toNotificationResponse } from '../mappers/notification.mapper';
import { PushProviderService } from './push-provider.service';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly pushProviderService: PushProviderService,
    private readonly gateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job<DeliverNotificationJobData>): Promise<void> {
    if (job.name !== DELIVER_NOTIFICATION_JOB) {
      return;
    }

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { notification: true },
    });

    if (!delivery || delivery.status !== DeliveryStatus.PENDING) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: delivery.notification.userId },
    });

    if (!user) {
      await this.markFailed(delivery.id, 'Recipient user not found');
      return;
    }

    try {
      await this.dispatch(delivery, user.id, user.email);

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.markFailed(delivery.id, (error as Error).message);
      throw error;
    }
  }

  private async dispatch(
    delivery: NotificationDelivery & { notification: Notification },
    userId: string,
    email: string,
  ): Promise<void> {
    switch (delivery.channel) {
      case NotificationChannel.EMAIL:
        await this.mailService.send({
          to: email,
          subject: delivery.subject ?? delivery.notification.title,
          html: delivery.body ?? delivery.notification.message,
        });
        return;
      case NotificationChannel.PUSH: {
        const tokens = await this.prisma.pushToken.findMany({
          where: { userId, isActive: true },
          select: { token: true },
        });
        await this.pushProviderService.send({
          tokens: tokens.map((token) => token.token),
          title: delivery.subject ?? delivery.notification.title,
          body: delivery.body ?? delivery.notification.message,
        });
        return;
      }
      case NotificationChannel.IN_APP:
        this.gateway.emitToUser(
          userId,
          toNotificationResponse(delivery.notification),
        );
        return;
    }
  }

  private async markFailed(deliveryId: string, error: string): Promise<void> {
    this.logger.warn(`Notification delivery ${deliveryId} failed: ${error}`);
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.FAILED, error },
    });
  }
}
