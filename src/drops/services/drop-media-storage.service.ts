import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DropMediaType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ALLOWED_MIME_TYPES: Record<
  string,
  { extension: string; type: DropMediaType }
> = {
  'image/jpeg': { extension: '.jpg', type: DropMediaType.IMAGE },
  'image/png': { extension: '.png', type: DropMediaType.IMAGE },
  'image/webp': { extension: '.webp', type: DropMediaType.IMAGE },
  'video/mp4': { extension: '.mp4', type: DropMediaType.VIDEO },
};

export interface StoredDropMedia {
  url: string;
  type: DropMediaType;
}

@Injectable()
export class DropMediaStorageService {
  private readonly uploadDir: string;
  private readonly publicPrefix = '/uploads/drops';

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('dropMedia.uploadDir') as string,
    );
  }

  getMaxSizeBytes(): number {
    return (
      (this.configService.get<number>('dropMedia.maxSizeMb') as number) *
      1024 *
      1024
    );
  }

  async save(file: Express.Multer.File): Promise<StoredDropMedia> {
    const mapping = ALLOWED_MIME_TYPES[file.mimetype];

    if (!mapping) {
      throw new UnsupportedMediaTypeException(
        'Media must be a JPEG, PNG, WEBP image or an MP4 video',
      );
    }

    const filename = `${randomUUID()}${mapping.extension}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return { url: `${this.publicPrefix}/${filename}`, type: mapping.type };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(this.publicPrefix)) {
      return;
    }

    const filename = url.slice(this.publicPrefix.length + 1);
    if (!filename) {
      return;
    }

    try {
      await unlink(join(this.uploadDir, filename));
    } catch {
      // File already missing — nothing to clean up.
    }
  }
}
