import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service';
import { RedisLockService } from './redis-lock.service';

describe('RedisLockService', () => {
  let client: { set: ReturnType<typeof vi.fn>; eval: ReturnType<typeof vi.fn> };
  let redisService: { getClient: ReturnType<typeof vi.fn> };
  let service: RedisLockService;

  beforeEach(() => {
    client = { set: vi.fn(), eval: vi.fn() };
    redisService = { getClient: vi.fn().mockReturnValue(client) };
    service = new RedisLockService(redisService as unknown as RedisService);
  });

  describe('acquire', () => {
    it('returns a token when the lock is free', async () => {
      client.set.mockResolvedValue('OK');

      const token = await service.acquire('deal-health:deal-1', 5000);

      expect(token).toEqual(expect.any(String));
      expect(client.set).toHaveBeenCalledWith(
        'lock:deal-health:deal-1',
        token,
        'PX',
        5000,
        'NX',
      );
    });

    it('returns null when the lock is already held', async () => {
      client.set.mockResolvedValue(null);

      const token = await service.acquire('deal-health:deal-1', 5000);

      expect(token).toBeNull();
    });
  });

  describe('release', () => {
    it('returns true when the token matches and the key is deleted', async () => {
      client.eval.mockResolvedValue(1);

      const result = await service.release('deal-health:deal-1', 'token-1');

      expect(result).toBe(true);
      expect(client.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'lock:deal-health:deal-1',
        'token-1',
      );
    });

    it('returns false when the token does not match', async () => {
      client.eval.mockResolvedValue(0);

      const result = await service.release('deal-health:deal-1', 'stale-token');

      expect(result).toBe(false);
    });
  });

  describe('withLock', () => {
    it('runs fn and releases the lock when acquisition succeeds', async () => {
      client.set.mockResolvedValue('OK');
      client.eval.mockResolvedValue(1);
      const fn = vi.fn().mockResolvedValue('done');

      const result = await service.withLock('queue:job-1', 5000, fn);

      expect(result).toBe('done');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(client.eval).toHaveBeenCalledTimes(1);
    });

    it('skips fn and returns undefined when the lock is already held', async () => {
      client.set.mockResolvedValue(null);
      const fn = vi.fn();

      const result = await service.withLock('queue:job-1', 5000, fn);

      expect(result).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
      expect(client.eval).not.toHaveBeenCalled();
    });

    it('still releases the lock when fn throws', async () => {
      client.set.mockResolvedValue('OK');
      client.eval.mockResolvedValue(1);
      const fn = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(service.withLock('queue:job-1', 5000, fn)).rejects.toThrow(
        'boom',
      );

      expect(client.eval).toHaveBeenCalledTimes(1);
    });
  });
});
