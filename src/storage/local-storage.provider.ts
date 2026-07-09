import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { StorageProvider, UploadResult } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async upload(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<UploadResult> {
    const filePath = resolve(this.baseDir, params.key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.buffer);

    return { key: params.key, url: `${this.baseUrl}/${params.key}` };
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Date.now() + expiresInSeconds * 1000;
    const signature = this.sign(key, expires);
    return Promise.resolve(
      `${this.baseUrl}/${key}?expires=${expires}&signature=${signature}`,
    );
  }

  async delete(key: string): Promise<void> {
    await rm(resolve(this.baseDir, key), { force: true });
  }

  /** Verifies a URL produced by getSignedUrl. Real HMAC verification, not a
   * stub — this is what a route serving private local files would call
   * before streaming the file back. */
  verifySignedUrl(key: string, expires: number, signature: string): boolean {
    if (Date.now() > expires) {
      return false;
    }

    const expected = Buffer.from(this.sign(key, expires));
    const actual = Buffer.from(signature);

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');
  }

  private get baseDir(): string {
    return this.configService.get<string>('storage.localDir') as string;
  }

  private get baseUrl(): string {
    return this.configService.get<string>(
      'storage.localPublicBaseUrl',
    ) as string;
  }

  private get signingSecret(): string {
    return this.configService.get<string>('storage.signingSecret') as string;
  }
}
