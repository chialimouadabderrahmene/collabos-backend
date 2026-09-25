import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { LocalStorageProvider } from './local-storage.provider';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage-provider.interface';

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

/**
 * Serves objects stored by the local storage provider, but only through a
 * valid, unexpired HMAC-signed URL (see LocalStorageProvider.getSignedUrl).
 * When the S3 provider is active, objects are served by the bucket/CDN via
 * presigned URLs and this route always 404s.
 *
 * Every failure mode returns the same 404 so the route cannot be used to
 * probe which keys exist.
 */
@ApiExcludeController()
@Public()
@Controller({ path: 'storage', version: VERSION_NEUTRAL })
export class StorageController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
    private readonly localProvider: LocalStorageProvider,
  ) {}

  @Get('*key')
  async serve(
    @Param('key') keyParam: string | string[],
    @Query('expires') expiresParam: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam;
    const expires = Number(expiresParam);

    if (
      this.provider !== this.localProvider ||
      !signature ||
      !this.localProvider.verifySignedUrl(key, expires, signature)
    ) {
      throw new NotFoundException('File not found');
    }

    let body: Buffer;
    try {
      body = await this.localProvider.read(key);
    } catch {
      throw new NotFoundException('File not found');
    }

    const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
    const maxAgeSeconds = Math.max(
      0,
      Math.floor((expires - Date.now()) / 1000),
    );

    res.setHeader(
      'Content-Type',
      CONTENT_TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream',
    );
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', `private, max-age=${maxAgeSeconds}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // helmet defaults CORP to same-origin; signed assets are embedded by the
    // frontend (a different origin), and the signature is the access control.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(body);
  }
}
