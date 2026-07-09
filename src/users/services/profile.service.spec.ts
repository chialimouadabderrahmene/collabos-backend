import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarStorageService } from './avatar-storage.service';
import { ProfileService } from './profile.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@brand.com',
    isEmailVerified: true,
    isActive: true,
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    bio: null,
    avatarUrl: '/uploads/avatars/old.jpg',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [{ name: 'USER' }],
    ...overrides,
  };
}

describe('ProfileService', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let avatarStorage: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getMaxSizeBytes: ReturnType<typeof vi.fn>;
  };
  let service: ProfileService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    avatarStorage = {
      save: vi.fn(),
      delete: vi.fn(),
      getMaxSizeBytes: vi.fn().mockReturnValue(5 * 1024 * 1024),
    };
    service = new ProfileService(
      prisma as unknown as PrismaService,
      avatarStorage as unknown as AvatarStorageService,
    );
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('persists the profile fields and returns the mapped user', async () => {
      prisma.user.update.mockResolvedValue(buildUser({ bio: 'Updated bio' }));

      const result = await service.updateProfile('user-1', {
        bio: 'Updated bio',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { bio: 'Updated bio' },
        include: { roles: true },
      });
      expect(result.bio).toBe('Updated bio');
    });
  });

  describe('setAvatar', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.setAvatar('user-1', undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws PayloadTooLargeException when the file exceeds the limit', async () => {
      const file = { size: 10 * 1024 * 1024 } as Express.Multer.File;

      await expect(service.setAvatar('user-1', file)).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      );
    });

    it('saves the new avatar and deletes the previous one', async () => {
      const file = { size: 1024, mimetype: 'image/png' } as Express.Multer.File;
      prisma.user.findUnique.mockResolvedValue(buildUser());
      avatarStorage.save.mockResolvedValue('/uploads/avatars/new.png');
      prisma.user.update.mockResolvedValue(
        buildUser({ avatarUrl: '/uploads/avatars/new.png' }),
      );

      const result = await service.setAvatar('user-1', file);

      expect(avatarStorage.save).toHaveBeenCalledWith('user-1', file);
      expect(avatarStorage.delete).toHaveBeenCalledWith(
        '/uploads/avatars/old.jpg',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: '/uploads/avatars/new.png' },
      });
      expect(result.avatarUrl).toBe('/uploads/avatars/new.png');
    });
  });

  describe('removeAvatar', () => {
    it('deletes the stored file and clears the avatar url', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ avatarUrl: null }));

      const result = await service.removeAvatar('user-1');

      expect(avatarStorage.delete).toHaveBeenCalledWith(
        '/uploads/avatars/old.jpg',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: null },
      });
      expect(result.avatarUrl).toBeNull();
    });
  });
});
