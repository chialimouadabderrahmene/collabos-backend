import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let prisma: {
    userSettings: { upsert: ReturnType<typeof vi.fn> };
    userPreferences: { upsert: ReturnType<typeof vi.fn> };
    notificationPreferences: { upsert: ReturnType<typeof vi.fn> };
    privacySettings: { upsert: ReturnType<typeof vi.fn> };
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      userSettings: { upsert: vi.fn() },
      userPreferences: { upsert: vi.fn() },
      notificationPreferences: { upsert: vi.fn() },
      privacySettings: { upsert: vi.fn() },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  describe('settings', () => {
    it('creates default settings on first read', async () => {
      prisma.userSettings.upsert.mockResolvedValue({
        theme: 'SYSTEM',
        language: 'en',
        timezone: 'UTC',
      });

      const result = await service.getSettings('user-1');

      expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {},
        create: { userId: 'user-1' },
      });
      expect(result.theme).toBe('SYSTEM');
    });

    it('updates existing settings', async () => {
      prisma.userSettings.upsert.mockResolvedValue({
        theme: 'DARK',
        language: 'fr',
        timezone: 'Europe/Paris',
      });

      await service.updateSettings('user-1', {
        theme: 'DARK',
        language: 'fr',
      });

      expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { theme: 'DARK', language: 'fr' },
        create: { userId: 'user-1', theme: 'DARK', language: 'fr' },
      });
    });
  });

  describe('preferences', () => {
    it('creates default preferences on first read', async () => {
      prisma.userPreferences.upsert.mockResolvedValue({
        digestFrequency: 'WEEKLY',
        measurementUnit: 'METRIC',
      });

      const result = await service.getPreferences('user-1');

      expect(result.measurementUnit).toBe('METRIC');
    });

    it('updates existing preferences', async () => {
      prisma.userPreferences.upsert.mockResolvedValue({
        digestFrequency: 'NEVER',
        measurementUnit: 'IMPERIAL',
      });

      await service.updatePreferences('user-1', {
        measurementUnit: 'IMPERIAL',
      });

      expect(prisma.userPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { measurementUnit: 'IMPERIAL' },
        create: { userId: 'user-1', measurementUnit: 'IMPERIAL' },
      });
    });
  });

  describe('notification preferences', () => {
    it('creates defaults on first read', async () => {
      prisma.notificationPreferences.upsert.mockResolvedValue({
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
      });

      const result = await service.getNotificationPreferences('user-1');

      expect(result.emailNotifications).toBe(true);
    });

    it('updates existing preferences', async () => {
      prisma.notificationPreferences.upsert.mockResolvedValue({
        emailNotifications: false,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: false,
      });

      await service.updateNotificationPreferences('user-1', {
        emailNotifications: false,
      });

      expect(prisma.notificationPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { emailNotifications: false },
        create: { userId: 'user-1', emailNotifications: false },
      });
    });
  });

  describe('privacy settings', () => {
    it('creates defaults on first read', async () => {
      prisma.privacySettings.upsert.mockResolvedValue({
        profileVisibility: 'PUBLIC',
        showEmail: false,
        allowSearchIndexing: true,
      });

      const result = await service.getPrivacySettings('user-1');

      expect(result.profileVisibility).toBe('PUBLIC');
    });

    it('updates existing privacy settings', async () => {
      prisma.privacySettings.upsert.mockResolvedValue({
        profileVisibility: 'PRIVATE',
        showEmail: false,
        allowSearchIndexing: false,
      });

      await service.updatePrivacySettings('user-1', {
        profileVisibility: 'PRIVATE',
        allowSearchIndexing: false,
      });

      expect(prisma.privacySettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { profileVisibility: 'PRIVATE', allowSearchIndexing: false },
        create: {
          userId: 'user-1',
          profileVisibility: 'PRIVATE',
          allowSearchIndexing: false,
        },
      });
    });
  });
});
