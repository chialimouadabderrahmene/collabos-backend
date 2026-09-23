import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageProvider } from './local-storage.provider';

const { mkdirMock, writeFileMock, rmMock, readFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn().mockResolvedValue(undefined),
  writeFileMock: vi.fn().mockResolvedValue(undefined),
  rmMock: vi.fn().mockResolvedValue(undefined),
  readFileMock: vi.fn().mockResolvedValue(Buffer.from('data')),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  rm: rmMock,
  readFile: readFileMock,
}));

function buildConfig() {
  const values: Record<string, string> = {
    'storage.localDir': '/tmp/uploads',
    'storage.localPublicBaseUrl': 'http://localhost:3000/storage',
    'storage.signingSecret': 'test-secret',
  };
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalStorageProvider(buildConfig());
  });

  describe('upload', () => {
    it('writes the file to disk and returns its public url', async () => {
      const result = await provider.upload({
        key: 'avatars/user-1.png',
        buffer: Buffer.from('data'),
        contentType: 'image/png',
      });

      expect(mkdirMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalled();
      expect(result).toEqual({
        key: 'avatars/user-1.png',
        url: 'http://localhost:3000/storage/avatars/user-1.png',
      });
    });
  });

  describe('delete', () => {
    it('removes the file, tolerating a missing file', async () => {
      await provider.delete('avatars/user-1.png');

      expect(rmMock).toHaveBeenCalledWith(
        expect.stringContaining('user-1.png'),
        { force: true },
      );
    });
  });

  describe('getSignedUrl + verifySignedUrl', () => {
    it('produces a url whose signature verifies successfully', async () => {
      const url = await provider.getSignedUrl('private/file.pdf', 60);
      const parsed = new URL(url);
      const expires = Number(parsed.searchParams.get('expires'));
      const signature = parsed.searchParams.get('signature') as string;

      expect(
        provider.verifySignedUrl('private/file.pdf', expires, signature),
      ).toBe(true);
    });

    it('rejects a tampered signature', async () => {
      const url = await provider.getSignedUrl('private/file.pdf', 60);
      const parsed = new URL(url);
      const expires = Number(parsed.searchParams.get('expires'));

      expect(
        provider.verifySignedUrl('private/file.pdf', expires, 'tampered'),
      ).toBe(false);
    });

    it('rejects an expired signature', async () => {
      const url = await provider.getSignedUrl('private/file.pdf', -1);
      const parsed = new URL(url);
      const expires = Number(parsed.searchParams.get('expires'));
      const signature = parsed.searchParams.get('signature') as string;

      expect(
        provider.verifySignedUrl('private/file.pdf', expires, signature),
      ).toBe(false);
    });

    it('rejects a signature for a different key', async () => {
      const url = await provider.getSignedUrl('private/file.pdf', 60);
      const parsed = new URL(url);
      const expires = Number(parsed.searchParams.get('expires'));
      const signature = parsed.searchParams.get('signature') as string;

      expect(
        provider.verifySignedUrl('private/other.pdf', expires, signature),
      ).toBe(false);
    });
  });

  describe('path traversal protection', () => {
    it.each([
      '../outside.txt',
      'a/../../outside.txt',
      '/etc/passwd',
      'a\\..\\b',
      '',
      'a//b',
    ])('refuses unsafe key %j', async (key) => {
      await expect(
        provider.upload({
          key,
          buffer: Buffer.from('x'),
          contentType: 'text/plain',
        }),
      ).rejects.toThrow('Invalid storage key');
      await expect(provider.delete(key)).rejects.toThrow('Invalid storage key');
      expect(provider.verifySignedUrl(key, Date.now() + 1000, 'sig')).toBe(
        false,
      );
    });

    it('never writes outside the storage root', async () => {
      await expect(
        provider.upload({
          key: '../escape.png',
          buffer: Buffer.from('x'),
          contentType: 'image/png',
        }),
      ).rejects.toThrow();
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });

  it('refuses to sign without a signing secret', async () => {
    const unsigned = new LocalStorageProvider({
      get: vi.fn((key: string) =>
        key === 'storage.signingSecret' ? undefined : '/tmp/uploads',
      ),
    } as unknown as ConfigService);

    await expect(unsigned.getSignedUrl('a/b.png', 60)).rejects.toThrow(
      'STORAGE_SIGNING_SECRET',
    );
  });
});
