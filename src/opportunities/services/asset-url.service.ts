import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../storage/storage-provider.interface';

export interface SignedAssetUrl {
  url: string;
  urlExpiresAt: Date;
}

/** Turns internal storage keys into short-lived signed URLs. Storage keys and
 * bucket paths never leave the backend. */
@Injectable()
export class AssetUrlService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly configService: ConfigService,
  ) {}

  async sign(storageKey: string): Promise<SignedAssetUrl> {
    const ttlSeconds =
      this.configService.get<number>('opportunities.assetUrlTtlSeconds') ?? 900;
    const url = await this.storage.getSignedUrl(storageKey, ttlSeconds);
    return { url, urlExpiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }
}
