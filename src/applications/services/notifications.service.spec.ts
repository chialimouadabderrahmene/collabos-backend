import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

function buildNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'APPLICATION_RECEIVED',
    title: 'New application received',
    message: 'Your brief received a new application.',
    isRead: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let prisma: {
    notification: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated notifications with an unread count', async () => {
      prisma.$transaction.mockResolvedValue([[buildNotification()], 1, 1]);

      const result = await service.findAll('user-1', { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.data[0].title).toBe('New application received');
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException for a notification belonging to another user', async () => {
      prisma.notification.findUnique.mockResolvedValue(
        buildNotification({ userId: 'someone-else' }),
      );

      await expect(
        service.markRead('notif-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks the notification as read', async () => {
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
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead('user-1');

      expect(result).toEqual({ updated: 3 });
    });
  });
});
