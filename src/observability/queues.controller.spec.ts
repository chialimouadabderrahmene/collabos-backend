import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueuesController } from './queues.controller';

describe('QueuesController', () => {
  let dropsQueue: { getJobCounts: ReturnType<typeof vi.fn> };
  let notificationsQueue: { getJobCounts: ReturnType<typeof vi.fn> };
  let controller: QueuesController;

  beforeEach(() => {
    dropsQueue = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 1,
        active: 0,
        completed: 10,
        failed: 2,
        delayed: 3,
      }),
    };
    notificationsQueue = {
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 0,
        active: 1,
        completed: 50,
        failed: 0,
        delayed: 0,
      }),
    };
    controller = new QueuesController(
      dropsQueue as never,
      notificationsQueue as never,
    );
  });

  describe('getStatus', () => {
    it('returns job counts for every registered queue', async () => {
      const result = await controller.getStatus();

      expect(result.queues).toEqual([
        {
          name: 'drops',
          waiting: 1,
          active: 0,
          completed: 10,
          failed: 2,
          delayed: 3,
        },
        {
          name: 'notifications',
          waiting: 0,
          active: 1,
          completed: 50,
          failed: 0,
          delayed: 0,
        },
      ]);
    });

    it('defaults missing counts to zero', async () => {
      dropsQueue.getJobCounts.mockResolvedValue({});

      const result = await controller.getStatus();

      expect(result.queues[0]).toEqual({
        name: 'drops',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });
});
