import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { createStorageProvider } from './storage-provider.factory';

function buildConfig(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('createStorageProvider', () => {
  const local = { marker: 'local' } as unknown as LocalStorageProvider;
  const s3 = { marker: 's3' } as unknown as S3StorageProvider;

  it('returns the local provider by default', () => {
    const provider = createStorageProvider(
      buildConfig({ 'storage.provider': 'local' }),
      local,
      s3,
    );

    expect(provider).toBe(local);
  });

  it('returns the s3 provider when fully configured', () => {
    const provider = createStorageProvider(
      buildConfig({
        'storage.provider': 's3',
        'storage.s3Bucket': 'bucket',
        'storage.s3AccessKeyId': 'key',
        'storage.s3SecretAccessKey': 'secret',
      }),
      local,
      s3,
    );

    expect(provider).toBe(s3);
  });

  it('throws when s3 is selected without required credentials', () => {
    expect(() =>
      createStorageProvider(
        buildConfig({ 'storage.provider': 's3' }),
        local,
        s3,
      ),
    ).toThrow(/STORAGE_PROVIDER=s3 requires/);
  });
});
