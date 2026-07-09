import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { DropMediaStorageService } from './drop-media-storage.service';
import { DropMediaService } from './drop-media.service';
import { DropsService } from './drops.service';

function buildDrop(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'drop-1', brandId: 'brand-1', ...overrides };
}

function buildMedia(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'media-1',
    dropId: 'drop-1',
    url: '/uploads/drops/file.jpg',
    type: 'IMAGE',
    altText: null,
    position: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DropMediaService', () => {
  let prisma: {
    dropMedia: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let dropsService: DropsService;
  let mediaStorage: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getMaxSizeBytes: ReturnType<typeof vi.fn>;
  };
  let service: DropMediaService;

  beforeEach(() => {
    prisma = {
      dropMedia: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    };
    dropsService = {
      findEntityOrThrow: vi.fn().mockResolvedValue(buildDrop()),
      assertOwnerOrAdmin: vi.fn().mockResolvedValue(undefined),
      assertViewable: vi.fn().mockResolvedValue(undefined),
    } as unknown as DropsService;
    mediaStorage = {
      save: vi.fn(),
      delete: vi.fn(),
      getMaxSizeBytes: vi.fn().mockReturnValue(20 * 1024 * 1024),
    };
    service = new DropMediaService(
      prisma as unknown as PrismaService,
      dropsService,
      mediaStorage as unknown as DropMediaStorageService,
    );
  });

  describe('add', () => {
    it('rejects when no file is provided', async () => {
      await expect(
        service.add('drop-1', { id: 'owner-1' } as never, {}, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a file larger than the configured limit', async () => {
      const file = { size: 30 * 1024 * 1024 } as Express.Multer.File;

      await expect(
        service.add('drop-1', { id: 'owner-1' } as never, {}, file),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('stores the file and creates a media row', async () => {
      const file = {
        size: 1024,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      mediaStorage.save.mockResolvedValue({
        url: '/uploads/drops/file.jpg',
        type: 'IMAGE',
      });
      prisma.dropMedia.create.mockResolvedValue(buildMedia());

      const result = await service.add(
        'drop-1',
        { id: 'owner-1' } as never,
        { position: 1 },
        file,
      );

      expect(prisma.dropMedia.create).toHaveBeenCalledWith({
        data: {
          dropId: 'drop-1',
          url: '/uploads/drops/file.jpg',
          type: 'IMAGE',
          altText: undefined,
          position: 1,
        },
      });
      expect(result.url).toBe('/uploads/drops/file.jpg');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for media belonging to another drop', async () => {
      prisma.dropMedia.findUnique.mockResolvedValue(
        buildMedia({ dropId: 'other-drop' }),
      );

      await expect(
        service.remove('drop-1', 'media-1', { id: 'owner-1' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.dropMedia.delete).not.toHaveBeenCalled();
    });

    it('deletes the stored file and the media row', async () => {
      prisma.dropMedia.findUnique.mockResolvedValue(buildMedia());

      const result = await service.remove('drop-1', 'media-1', {
        id: 'owner-1',
      } as never);

      expect(mediaStorage.delete).toHaveBeenCalledWith(
        '/uploads/drops/file.jpg',
      );
      expect(prisma.dropMedia.delete).toHaveBeenCalledWith({
        where: { id: 'media-1' },
      });
      expect(result.message).toBe('Media removed');
    });
  });
});
