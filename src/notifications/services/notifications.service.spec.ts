import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { TemplatesService } from './templates.service';

function buildTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'template-1',
    key: 'order.paid',
    name: 'Order Paid',
    emailSubject: 'Order paid',
    emailBody: 'Your order was paid',
    pushTitle: 'Order paid',
    pushBody: 'Your order was paid',
    inAppBody: 'Your order was paid',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPreferences(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pref-1',
    userId: 'user-1',
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe('NotificationsService', () => {
  let prisma: {
    notification: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    notificationDelivery: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let queue: { add: ReturnType<typeof vi.fn> };
  let templatesService: {
    getActiveOrThrow: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  };
  let preferencesService: { getOrCreate: ReturnType<typeof vi.fn> };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      notificationDelivery: { create: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    queue = { add: vi.fn() };
    templatesService = {
      getActiveOrThrow: vi.fn().mockResolvedValue(buildTemplate()),
      render: vi.fn().mockReturnValue({
        emailSubject: 'Order paid',
        emailBody: 'Your order was paid',
        pushTitle: 'Order paid',
        pushBody: 'Your order was paid',
        inAppBody: 'Your order was paid',
      }),
    };
    preferencesService = {
      getOrCreate: vi.fn().mockResolvedValue(buildPreferences()),
    };
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      queue as never,
      templatesService as unknown as TemplatesService,
      preferencesService as unknown as PreferencesService,
    );
  });

  describe('notify', () => {
    it('creates the notification and a delivery per channel, queuing enabled channels', async () => {
      prisma.notification.create.mockResolvedValue(buildNotification());
      let deliveryCounter = 0;
      prisma.notificationDelivery.create.mockImplementation(
        ({ data }: { data: { channel: string; status: string } }) =>
          Promise.resolve({
            id: `delivery-${++deliveryCounter}`,
            ...data,
          }),
      );

      await service.notify({
        userId: 'user-1',
        templateKey: 'order.paid',
      });

      expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(3);
      expect(queue.add).toHaveBeenCalledTimes(3);
    });

    it('marks a disabled channel SKIPPED and does not enqueue it', async () => {
      preferencesService.getOrCreate.mockResolvedValue(
        buildPreferences({ pushNotifications: false }),
      );
      prisma.notification.create.mockResolvedValue(buildNotification());
      prisma.notificationDelivery.create.mockImplementation(
        ({ data }: { data: { channel: string; status: string } }) =>
          Promise.resolve({ id: 'delivery-x', ...data }),
      );

      await service.notify({ userId: 'user-1', templateKey: 'order.paid' });

      const pushCall = prisma.notificationDelivery.create.mock.calls.find(
        (call) =>
          (call[0] as { data: { channel: string } }).data.channel === 'PUSH',
      ) as [{ data: { status: string } }];
      expect(pushCall[0].data.status).toBe('SKIPPED');
      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it('only creates deliveries for explicitly requested channels', async () => {
      prisma.notification.create.mockResolvedValue(buildNotification());
      prisma.notificationDelivery.create.mockImplementation(
        ({ data }: { data: { channel: string; status: string } }) =>
          Promise.resolve({ id: 'delivery-x', ...data }),
      );

      await service.notify({
        userId: 'user-1',
        templateKey: 'order.paid',
        channels: ['EMAIL'] as never,
      });

      expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException for a notification owned by another user', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        buildNotification({ userId: 'someone-else' }),
      );

      await expect(
        service.markRead('notif-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks the notification read', async () => {
      prisma.notification.findUnique.mockResolvedValue(buildNotification());
      prisma.notification.update.mockResolvedValue(
        buildNotification({ isRead: true }),
      );

      const result = await service.markRead('notif-1', 'user-1');

      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('returns the number of notifications updated', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllRead('user-1');

      expect(result).toEqual({ updated: 4 });
    });
  });

  describe('findMine', () => {
    it('returns a paginated inbox with the unread count', async () => {
      prisma.notification.findMany.mockResolvedValue([buildNotification()]);
      prisma.notification.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.findMine('user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });
  });
});
