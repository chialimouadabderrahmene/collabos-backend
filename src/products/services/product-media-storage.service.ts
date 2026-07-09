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
export class ProductMediaStorageService {
  private readonly uploadDir: string;
  private readonly publicPrefix = '/uploads/products';

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('productMedia.uploadDir') as string,
    );
  }

  getMaxSizeBytes(): number {
    return (
      (this.configService.get<number>('productMedia.maxSizeMb') as number) *
      1024 *
      1024
    );
  }

  async save(file: Express.Multer.File): Promise<string> {
    const extension = ALLOWED_MIME_TYPES[file.mimetype];

    if (!extension) {
      throw new UnsupportedMediaTypeException(
        'Media must be a JPEG, PNG or WEBP image',
      );
    }

    const filename = `${randomUUID()}${extension}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return `${this.publicPrefix}/${filename}`;
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
