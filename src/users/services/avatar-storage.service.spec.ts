import { UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarStorageService } from './avatar-storage.service';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('AvatarStorageService', () => {
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: AvatarStorageService;

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'avatar.uploadDir') return './uploads/avatars';
        if (key === 'avatar.maxSizeMb') return 5;
        return undefined;
      }),
    };
    service = new AvatarStorageService(
      configService as unknown as ConfigService,
    );
  });

  describe('getMaxSizeBytes', () => {
    it('converts megabytes to bytes', () => {
      expect(service.getMaxSizeBytes()).toBe(5 * 1024 * 1024);
    });
  });

  describe('save', () => {
    it('rejects unsupported mime types', async () => {
      const file = {
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
      } as Express.Multer.File;

      await expect(service.save('user-1', file)).rejects.toBeInstanceOf(
        UnsupportedMediaTypeException,
      );
    });

    it('persists an allowed image and returns its public url', async () => {
      const file = {
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      const url = await service.save('user-1', file);

      expect(url).toMatch(/^\/uploads\/avatars\/user-1-.+\.png$/);
    });
  });

  describe('delete', () => {
    it('is a no-op for null urls', async () => {
      await expect(service.delete(null)).resolves.toBeUndefined();
    });

    it('is a no-op for urls outside the avatar prefix', async () => {
      await expect(
        service.delete('/uploads/other/file.png'),
      ).resolves.toBeUndefined();
    });
  });
});
