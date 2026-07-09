import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let client: {
    get: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };
  let redisService: { getClient: ReturnType<typeof vi.fn> };
  let service: CacheService;

  beforeEach(() => {
    client = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    };
    redisService = { getClient: vi.fn().mockReturnValue(client) };
    service = new CacheService(redisService as unknown as RedisService);
  });

  describe('getOrCompute', () => {
    it('computes and caches on a miss', async () => {
      client.get.mockResolvedValue(null);
      const compute = vi.fn().mockResolvedValue({ score: 42 });

      const result = await service.getOrCompute('key-1', 60, compute);

      expect(compute).toHaveBeenCalledTimes(1);
      expect(client.setex).toHaveBeenCalledWith(
        'ai:cache:key-1',
        60,
        JSON.stringify({ score: 42 }),
      );
      expect(result).toEqual({ value: { score: 42 }, cached: false });
    });

    it('returns the cached value without recomputing on a hit', async () => {
      client.get.mockResolvedValue(JSON.stringify({ score: 42 }));
      const compute = vi.fn();

      const result = await service.getOrCompute('key-1', 60, compute);

      expect(compute).not.toHaveBeenCalled();
      expect(result).toEqual({ value: { score: 42 }, cached: true });
    });
  });

  describe('invalidate', () => {
    it('deletes the namespaced key', async () => {
      await service.invalidate('key-1');

      expect(client.del).toHaveBeenCalledWith('ai:cache:key-1');
    });
  });

  describe('invalidatePrefix', () => {
    it('deletes every matching key', async () => {
      client.keys.mockResolvedValue([
        'ai:cache:deal-health:1',
        'ai:cache:deal-health:2',
      ]);

      await service.invalidatePrefix('deal-health:');

      expect(client.keys).toHaveBeenCalledWith('ai:cache:deal-health:*');
      expect(client.del).toHaveBeenCalledWith(
        'ai:cache:deal-health:1',
        'ai:cache:deal-health:2',
      );
    });

    it('does nothing when no keys match', async () => {
      client.keys.mockResolvedValue([]);

      await service.invalidatePrefix('deal-health:');

      expect(client.del).not.toHaveBeenCalled();
    });
  });
});
