import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';

const LOCK_PREFIX = 'lock:';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redisService: RedisService) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redisService
      .getClient()
      .set(LOCK_PREFIX + key, token, 'PX', ttlMs, 'NX');

    return result === 'OK' ? token : null;
  }

  async release(key: string, token: string): Promise<boolean> {
    const result = await this.redisService
      .getClient()
      .eval(RELEASE_SCRIPT, 1, LOCK_PREFIX + key, token);

    return result === 1;
  }

  /**
   * Runs fn only if the lock is acquired; otherwise resolves to undefined
   * without running fn. Always releases the lock afterwards (if acquired).
   */
  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    const token = await this.acquire(key, ttlMs);

    if (!token) {
      this.logger.debug(`Skipped "${key}": already locked`);
      return undefined;
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}
