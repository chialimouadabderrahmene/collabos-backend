import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({}),
  getSignedUrlMock: vi
    .fn()
    .mockResolvedValue('https://signed.example.com/file'),
}));

const { PutObjectCommandMock, DeleteObjectCommandMock, GetObjectCommandMock } =
  vi.hoisted(() => ({
    PutObjectCommandMock: vi.fn().mockImplementation((input: unknown) => ({
      input,
    })),
    DeleteObjectCommandMock: vi.fn().mockImplementation((input: unknown) => ({
      input,
    })),
    GetObjectCommandMock: vi.fn().mockImplementation((input: unknown) => ({
      input,
    })),
  }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: PutObjectCommandMock,
  DeleteObjectCommand: DeleteObjectCommandMock,
  GetObjectCommand: GetObjectCommandMock,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { S3StorageProvider } from './s3-storage.provider';

function buildConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'storage.s3Bucket': 'my-bucket',
    'storage.s3Region': 'auto',
    'storage.s3Endpoint': 'https://account.r2.cloudflarestorage.com',
    'storage.s3AccessKeyId': 'key',
    'storage.s3SecretAccessKey': 'secret',
    'storage.s3PublicBaseUrl': undefined,
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('S3StorageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({});
    getSignedUrlMock.mockResolvedValue('https://signed.example.com/file');
  });

  describe('upload', () => {
    it('puts the object and returns a presigned url when no public base url is set', async () => {
      const provider = new S3StorageProvider(buildConfig());

      const result = await provider.upload({
        key: 'products/shirt.png',
        buffer: Buffer.from('data'),
        contentType: 'image/png',
      });

      expect(sendMock).toHaveBeenCalled();
      expect(result).toEqual({
        key: 'products/shirt.png',
        url: 'https://signed.example.com/file',
      });
    });

    it('returns a public CDN url when configured, skipping the presign call', async () => {
      const provider = new S3StorageProvider(
        buildConfig({ 'storage.s3PublicBaseUrl': 'https://cdn.example.com' }),
      );

      const result = await provider.upload({
        key: 'products/shirt.png',
        buffer: Buffer.from('data'),
        contentType: 'image/png',
      });

      expect(result).toEqual({
        key: 'products/shirt.png',
        url: 'https://cdn.example.com/products/shirt.png',
      });
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });
  });

  describe('getSignedUrl', () => {
    it('delegates to the presigner with the requested expiry', async () => {
      const provider = new S3StorageProvider(buildConfig());

      const url = await provider.getSignedUrl('products/shirt.png', 900);

      expect(url).toBe('https://signed.example.com/file');
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 900 },
      );
    });
  });

  describe('delete', () => {
    it('sends a delete command for the given key', async () => {
      const provider = new S3StorageProvider(buildConfig());

      await provider.delete('products/shirt.png');

      const call = sendMock.mock.calls[0][0] as { input: { Key: string } };
      expect(call.input.Key).toBe('products/shirt.png');
    });
  });
});
