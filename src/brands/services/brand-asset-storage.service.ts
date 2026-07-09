import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type BrandAssetKind = 'logo' | 'cover';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class BrandAssetStorageService {
  private readonly uploadDir: string;
  private readonly publicPrefix = '/uploads/brands';

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('brandAsset.uploadDir') as string,
    );
  }

  getMaxSizeBytes(kind: BrandAssetKind): number {
    const key =
      kind === 'logo'
        ? 'brandAsset.logoMaxSizeMb'
        : 'brandAsset.coverMaxSizeMb';
    return (this.configService.get<number>(key) as number) * 1024 * 1024;
  }

  private extensionFor(mimeType: string): string {
    const extension = ALLOWED_MIME_TYPES[mimeType];
    if (!extension) {
      throw new UnsupportedMediaTypeException(
        'Image must be a JPEG, PNG or WEBP file',
      );
    }
    return extension;
  }

  async save(
    brandId: string,
    kind: BrandAssetKind,
    file: Express.Multer.File,
  ): Promise<string> {
    const extension = this.extensionFor(file.mimetype);
    const filename = `${brandId}-${kind}-${randomUUID()}${extension}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return `${this.publicPrefix}/${filename}`;
  }

  async delete(assetUrl: string | null): Promise<void> {
    if (!assetUrl || !assetUrl.startsWith(this.publicPrefix)) {
      return;
    }

    const filename = assetUrl.slice(this.publicPrefix.length + 1);
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
