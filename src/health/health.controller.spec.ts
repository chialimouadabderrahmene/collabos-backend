import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let health: { check: ReturnType<typeof vi.fn> };
  let memory: { checkHeap: ReturnType<typeof vi.fn> };
  let disk: { checkStorage: ReturnType<typeof vi.fn> };
  let prismaHealth: { isHealthy: ReturnType<typeof vi.fn> };
  let redisHealth: { isHealthy: ReturnType<typeof vi.fn> };
  let controller: HealthController;

  beforeEach(() => {
    health = { check: vi.fn().mockResolvedValue({ status: 'ok' }) };
    memory = {
      checkHeap: vi.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
    };
    disk = {
      checkStorage: vi.fn().mockResolvedValue({ disk: { status: 'up' } }),
    };
    prismaHealth = {
      isHealthy: vi.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    redisHealth = {
      isHealthy: vi.fn().mockResolvedValue({ redis: { status: 'up' } }),
    };
    controller = new HealthController(
      health as never,
      memory as never,
      disk as never,
      prismaHealth as never,
      redisHealth as never,
    );
  });

  describe('check', () => {
    it('runs database, redis, memory, and disk indicators', async () => {
      await controller.check();

      const indicators = health.check.mock.calls[0][0] as Array<() => unknown>;
      expect(indicators).toHaveLength(4);
      await Promise.all(indicators.map((indicator) => indicator()));

      expect(prismaHealth.isHealthy).toHaveBeenCalledWith('database');
      expect(redisHealth.isHealthy).toHaveBeenCalledWith('redis');
      expect(memory.checkHeap).toHaveBeenCalled();
      expect(disk.checkStorage).toHaveBeenCalled();
    });
  });

  describe('live', () => {
    it('only checks memory, never external dependencies', async () => {
      await controller.live();

      const indicators = health.check.mock.calls[0][0] as Array<() => unknown>;
      expect(indicators).toHaveLength(1);
      await Promise.all(indicators.map((indicator) => indicator()));

      expect(memory.checkHeap).toHaveBeenCalled();
      expect(prismaHealth.isHealthy).not.toHaveBeenCalled();
      expect(redisHealth.isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('ready', () => {
    it('checks database, redis, and disk but not memory', async () => {
      await controller.ready();

      const indicators = health.check.mock.calls[0][0] as Array<() => unknown>;
      expect(indicators).toHaveLength(3);
      await Promise.all(indicators.map((indicator) => indicator()));

      expect(prismaHealth.isHealthy).toHaveBeenCalledWith('database');
      expect(redisHealth.isHealthy).toHaveBeenCalledWith('redis');
      expect(disk.checkStorage).toHaveBeenCalled();
      expect(memory.checkHeap).not.toHaveBeenCalled();
    });
  });
});
