import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { createStorageProvider } from './storage-provider.factory';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Module({
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: createStorageProvider,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
