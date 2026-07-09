import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class AvatarStorageService {
  private readonly uploadDir: string;
  private readonly publicPrefix = '/uploads/avatars';

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('avatar.uploadDir') as string,
    );
  }

  getMaxSizeBytes(): number {
    return (
      (this.configService.get<number>('avatar.maxSizeMb') as number) *
      1024 *
      1024
    );
  }

  private extensionFor(mimeType: string): string {
    const extension = ALLOWED_MIME_TYPES[mimeType];
    if (!extension) {
      throw new UnsupportedMediaTypeException(
        'Avatar must be a JPEG, PNG or WEBP image',
      );
    }
    return extension;
  }

  async save(userId: string, file: Express.Multer.File): Promise<string> {
    const extension = this.extensionFor(file.mimetype);
    const filename = `${userId}-${randomUUID()}${extension}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return `${this.publicPrefix}/${filename}`;
  }

  async delete(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl || !avatarUrl.startsWith(this.publicPrefix)) {
      return;
    }

    const filename = avatarUrl.slice(this.publicPrefix.length + 1);
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
