import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export interface StoredAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class AttachmentStorageService {
  private readonly uploadDir: string;
  private readonly publicPrefix = '/uploads/messages';

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('messageAttachment.uploadDir') as string,
    );
  }

  getMaxSizeBytes(): number {
    return (
      (this.configService.get<number>(
        'messageAttachment.maxSizeMb',
      ) as number) *
      1024 *
      1024
    );
  }

  async save(file: Express.Multer.File): Promise<StoredAttachment> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Attachment must be an image (JPEG, PNG, WEBP, GIF) or a PDF',
      );
    }

    const extension = extname(file.originalname) || '';
    const filename = `${randomUUID()}${extension}`;

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return {
      url: `${this.publicPrefix}/${filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }
}
