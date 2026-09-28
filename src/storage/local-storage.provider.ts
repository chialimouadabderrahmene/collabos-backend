import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { StorageProvider, UploadResult } from './storage-provider.interface';

/** Storage keys are relative paths made of safe segments only. Anything else
 * (absolute paths, `..`, backslashes, empty segments) is rejected before it
 * can reach the filesystem. */
const SAFE_KEY_PATTERN =
  /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async upload(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<UploadResult> {
    const filePath = this.resolveKey(params.key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.buffer);

    return { key: params.key, url: `${this.baseUrl}/${params.key}` };
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    try {
      this.assertSafeKey(key);
      const expires = Date.now() + expiresInSeconds * 1000;
      const signature = this.sign(key, expires);
      return Promise.resolve(
        `${this.baseUrl}/${key}?expires=${expires}&signature=${signature}`,
      );
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error('Failed to sign URL'),
      );
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  /** Reads a stored object. Only called after `verifySignedUrl` succeeded. */
  read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  isSafeKey(key: string): boolean {
    return SAFE_KEY_PATTERN.test(key) && !key.split('/').includes('..');
  }

  /** Verifies a URL produced by getSignedUrl. Real HMAC verification, not a
   * stub — this is what a route serving private local files would call
   * before streaming the file back. */
  verifySignedUrl(key: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || Date.now() > expires) {
      return false;
    }

    if (!this.isSafeKey(key)) {
      return false;
    }

    const expected = Buffer.from(this.sign(key, expires));
    const actual = Buffer.from(signature);

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private assertSafeKey(key: string): void {
    if (!this.isSafeKey(key)) {
      throw new Error('Invalid storage key');
    }
  }

  /** Resolves a key under the storage root, refusing anything that would
   * escape it (defence in depth on top of the key pattern). */
  private resolveKey(key: string): string {
    this.assertSafeKey(key);
    const root = resolve(this.baseDir);
    const filePath = resolve(root, key);

    if (!filePath.startsWith(root + sep)) {
      throw new Error('Invalid storage key');
    }

    return filePath;
  }

  private sign(key: string, expires: number): string {
    const secret = this.signingSecret;
    if (!secret) {
      throw new Error(
        'STORAGE_SIGNING_SECRET must be set to issue signed storage URLs',
      );
    }

    return createHmac('sha256', secret)
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

  private get signingSecret(): string | undefined {
    return this.configService.get<string>('storage.signingSecret');
  }
}
