import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const KEY_PREFIX = 'ai:cache:';

export interface CacheResult<T> {
  value: T;
  cached: boolean;
}

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<CacheResult<T>> {
    const fullKey = KEY_PREFIX + key;
    const client = this.redisService.getClient();

    const cached = await client.get(fullKey);
    if (cached !== null) {
      return { value: JSON.parse(cached) as T, cached: true };
    }

    const value = await compute();
    await client.setex(fullKey, ttlSeconds, JSON.stringify(value));
    return { value, cached: false };
  }

  async invalidate(key: string): Promise<void> {
    await this.redisService.getClient().del(KEY_PREFIX + key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const client = this.redisService.getClient();
    const keys = await client.keys(`${KEY_PREFIX}${prefix}*`);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}
