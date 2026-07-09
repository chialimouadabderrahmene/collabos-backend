import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';

function buildSettings(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'settings-1',
    maintenanceMode: false,
    newSignupsEnabled: true,
    announcementBanner: null,
    updatedById: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SettingsService', () => {
  let prisma: {
    platformSettings: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      platformSettings: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  describe('getSettings', () => {
    it('returns the existing row without creating a new one', async () => {
      prisma.platformSettings.findFirst.mockResolvedValue(buildSettings());

      const result = await service.getSettings();

      expect(result.maintenanceMode).toBe(false);
      expect(prisma.platformSettings.create).not.toHaveBeenCalled();
    });

    it('lazily creates a default row when none exists', async () => {
      prisma.platformSettings.findFirst.mockResolvedValue(null);
      prisma.platformSettings.create.mockResolvedValue(buildSettings());

      await service.getSettings();

      expect(prisma.platformSettings.create).toHaveBeenCalledWith({
        data: {},
      });
    });
  });

  describe('update', () => {
    it('applies the patch and stamps the updating admin', async () => {
      prisma.platformSettings.findFirst.mockResolvedValue(buildSettings());
      prisma.platformSettings.update.mockResolvedValue(
        buildSettings({ maintenanceMode: true }),
      );

      const result = await service.update(
        { id: 'admin-1', roles: ['ADMIN'] } as never,
        { maintenanceMode: true },
      );

      expect(prisma.platformSettings.update).toHaveBeenCalledWith({
        where: { id: 'settings-1' },
        data: { maintenanceMode: true, updatedById: 'admin-1' },
      });
      expect(result.maintenanceMode).toBe(true);
    });
  });
});
