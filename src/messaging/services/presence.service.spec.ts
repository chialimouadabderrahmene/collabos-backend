import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let client: {
    sadd: ReturnType<typeof vi.fn>;
    srem: ReturnType<typeof vi.fn>;
    scard: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
  };
  let redisService: { getClient: ReturnType<typeof vi.fn> };
  let service: PresenceService;

  beforeEach(() => {
    client = {
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      scard: vi.fn(),
      pipeline: vi.fn(),
    };
    redisService = { getClient: vi.fn().mockReturnValue(client) };
    service = new PresenceService(redisService as unknown as RedisService);
  });

  describe('addConnection', () => {
    it('adds the socket id and returns the new connection count', async () => {
      client.scard.mockResolvedValue(1);

      const count = await service.addConnection('user-1', 'socket-1');

      expect(client.sadd).toHaveBeenCalledWith(
        'messaging:presence:user-1',
        'socket-1',
      );
      expect(count).toBe(1);
    });
  });

  describe('removeConnection', () => {
    it('removes the socket id and returns the remaining count', async () => {
      client.scard.mockResolvedValue(0);

      const count = await service.removeConnection('user-1', 'socket-1');

      expect(client.srem).toHaveBeenCalledWith(
        'messaging:presence:user-1',
        'socket-1',
      );
      expect(count).toBe(0);
    });
  });

  describe('isOnline', () => {
    it('is true when at least one connection is tracked', async () => {
      client.scard.mockResolvedValue(2);

      await expect(service.isOnline('user-1')).resolves.toBe(true);
    });

    it('is false when no connections are tracked', async () => {
      client.scard.mockResolvedValue(0);

      await expect(service.isOnline('user-1')).resolves.toBe(false);
    });
  });

  describe('areOnline', () => {
    it('returns an empty map for an empty input', async () => {
      const result = await service.areOnline([]);
      expect(result.size).toBe(0);
    });

    it('maps each user id to its online status', async () => {
      client.pipeline.mockReturnValue({
        scard: vi.fn(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 0],
        ]),
      });

      const result = await service.areOnline(['user-1', 'user-2']);

      expect(result.get('user-1')).toBe(true);
      expect(result.get('user-2')).toBe(false);
    });
  });
});
