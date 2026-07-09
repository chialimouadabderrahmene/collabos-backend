import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { PreferencesService } from './preferences.service';

function buildPreferences(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pref-1',
    userId: 'user-1',
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PreferencesService', () => {
  let prisma: {
    notificationPreferences: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: PreferencesService;

  beforeEach(() => {
    prisma = {
      notificationPreferences: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new PreferencesService(prisma as unknown as PrismaService);
  });

  describe('getOrCreate', () => {
    it('returns the existing row without creating a new one', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue(
        buildPreferences(),
      );

      const result = await service.getOrCreate('user-1');

      expect(result.userId).toBe('user-1');
      expect(prisma.notificationPreferences.create).not.toHaveBeenCalled();
    });

    it('lazily creates default preferences when none exist', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue(null);
      prisma.notificationPreferences.create.mockResolvedValue(
        buildPreferences(),
      );

      await service.getOrCreate('user-1');

      expect(prisma.notificationPreferences.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('creates defaults first, then applies the patch', async () => {
      prisma.notificationPreferences.findUnique.mockResolvedValue(null);
      prisma.notificationPreferences.create.mockResolvedValue(
        buildPreferences(),
      );
      prisma.notificationPreferences.update.mockResolvedValue(
        buildPreferences({ pushNotifications: false }),
      );

      const result = await service.update('user-1', {
        pushNotifications: false,
      });

      expect(prisma.notificationPreferences.create).toHaveBeenCalled();
      expect(result.pushNotifications).toBe(false);
    });
  });
});
