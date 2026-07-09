import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DELIVER_NOTIFICATION_JOB } from '../constants/notifications-queue.constant';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';
import { PushProviderService } from './push-provider.service';

function buildNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'GENERIC',
    templateKey: 'order.paid',
    title: 'Order paid',
    message: 'Your order was paid',
    metadata: null,
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildDelivery(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'delivery-1',
    notificationId: 'notif-1',
    channel: 'EMAIL',
    status: 'PENDING',
    subject: 'Order paid',
    body: 'Your order was paid',
    error: null,
    sentAt: null,
    createdAt: new Date(),
    notification: buildNotification(),
    ...overrides,
  };
}

function buildJob(deliveryId = 'delivery-1', name = DELIVER_NOTIFICATION_JOB) {
  return { name, data: { deliveryId } } as never;
}

describe('NotificationsProcessor', () => {
  let prisma: {
    notificationDelivery: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
    pushToken: { findMany: ReturnType<typeof vi.fn> };
  };
  let mailService: { send: ReturnType<typeof vi.fn> };
  let pushProviderService: { send: ReturnType<typeof vi.fn> };
  let gateway: { emitToUser: ReturnType<typeof vi.fn> };
  let processor: NotificationsProcessor;

  beforeEach(() => {
    prisma = {
      notificationDelivery: { findUnique: vi.fn(), update: vi.fn() },
      user: { findUnique: vi.fn() },
      pushToken: { findMany: vi.fn() },
    };
    mailService = { send: vi.fn().mockResolvedValue(undefined) };
    pushProviderService = { send: vi.fn().mockResolvedValue(undefined) };
    gateway = { emitToUser: vi.fn() };
    processor = new NotificationsProcessor(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
      pushProviderService as unknown as PushProviderService,
      gateway as unknown as NotificationsGateway,
    );
  });

  describe('process', () => {
    it('ignores jobs with an unrelated name', async () => {
      await processor.process(buildJob('delivery-1', 'other-job'));

      expect(prisma.notificationDelivery.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing for a missing delivery', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(null);

      await processor.process(buildJob());

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('is idempotent for a delivery that already left PENDING', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(
        buildDelivery({ status: 'SENT' }),
      );

      await processor.process(buildJob());

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('marks the delivery FAILED when the recipient user no longer exists', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(buildDelivery());
      prisma.user.findUnique.mockResolvedValue(null);

      await processor.process(buildJob());

      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-1' },
        data: { status: 'FAILED', error: 'Recipient user not found' },
      });
    });

    it('sends an email and marks the delivery SENT', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(
        buildDelivery({ channel: 'EMAIL' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'buyer@example.com',
      });

      await processor.process(buildJob());

      expect(mailService.send).toHaveBeenCalledWith({
        to: 'buyer@example.com',
        subject: 'Order paid',
        html: 'Your order was paid',
      });

      const updateCall = prisma.notificationDelivery.update.mock
        .calls[0][0] as {
        data: { status: string };
      };
      expect(updateCall.data.status).toBe('SENT');
    });

    it('sends push notifications to the recipient active tokens', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(
        buildDelivery({ channel: 'PUSH' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'buyer@example.com',
      });
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'tok-1' },
        { token: 'tok-2' },
      ]);

      await processor.process(buildJob());

      expect(pushProviderService.send).toHaveBeenCalledWith({
        tokens: ['tok-1', 'tok-2'],
        title: 'Order paid',
        body: 'Your order was paid',
      });
    });

    it('emits an in-app event to the recipient over the gateway', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(
        buildDelivery({ channel: 'IN_APP' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'buyer@example.com',
      });

      await processor.process(buildJob());

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'notif-1' }),
      );
    });

    it('marks the delivery FAILED and rethrows when dispatch fails', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(
        buildDelivery({ channel: 'EMAIL' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'buyer@example.com',
      });
      mailService.send.mockRejectedValue(new Error('SMTP down'));

      await expect(processor.process(buildJob())).rejects.toThrow('SMTP down');

      expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
        where: { id: 'delivery-1' },
        data: { status: 'FAILED', error: 'SMTP down' },
      });
    });
  });
});
