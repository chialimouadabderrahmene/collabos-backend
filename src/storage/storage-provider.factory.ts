import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageProvider } from './storage-provider.interface';

export function createStorageProvider(
  configService: ConfigService,
  local: LocalStorageProvider,
  s3: S3StorageProvider,
): StorageProvider {
  const provider = configService.get<string>('storage.provider');

  if (provider === 's3') {
    const bucket = configService.get<string>('storage.s3Bucket');
    const accessKeyId = configService.get<string>('storage.s3AccessKeyId');
    const secretAccessKey = configService.get<string>(
      'storage.s3SecretAccessKey',
    );

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'STORAGE_PROVIDER=s3 requires STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY_ID, and STORAGE_S3_SECRET_ACCESS_KEY',
      );
    }

    return s3;
  }

  return local;
}
