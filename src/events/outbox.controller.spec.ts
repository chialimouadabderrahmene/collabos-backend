import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_KEY } from '../auth/auth.constants';
import { OutboxQueryService } from './outbox-query.service';
import { OutboxController } from './outbox.controller';
import { ReplayService } from './replay.service';

describe('OutboxController', () => {
  let outboxQueryService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrThrow: ReturnType<typeof vi.fn>;
  };
  let replayService: {
    replayById: ReturnType<typeof vi.fn>;
    replaySince: ReturnType<typeof vi.fn>;
  };
  let controller: OutboxController;

  beforeEach(() => {
    outboxQueryService = {
      list: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
      findOneOrThrow: vi.fn(),
    };
    replayService = {
      replayById: vi.fn().mockResolvedValue(true),
      replaySince: vi
        .fn()
        .mockResolvedValue({ attempted: 2, republished: 1, skipped: 1 }),
    };
    controller = new OutboxController(
      outboxQueryService as unknown as OutboxQueryService,
      replayService as unknown as ReplayService,
    );
  });

  describe('replayOne', () => {
    it('wraps the replay result in a response object', async () => {
      const result = await controller.replayOne('outbox-1');

      expect(replayService.replayById).toHaveBeenCalledWith('outbox-1');
      expect(result).toEqual({ republished: true });
    });

    it('requires the events:replay permission', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- inspecting decorator metadata, never invoking
      const method = OutboxController.prototype.replayOne;
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual([
        'events:replay',
      ]);
    });
  });

  describe('replaySince', () => {
    it('defaults to the epoch when no since date is given', async () => {
      await controller.replaySince({});

      expect(replayService.replaySince).toHaveBeenCalledWith(
        new Date(0),
        undefined,
      );
    });

    it('parses the given since date and passes the status filter through', async () => {
      await controller.replaySince({
        since: '2026-01-01',
        status: 'FAILED',
      });

      expect(replayService.replaySince).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        'FAILED',
      );
    });

    it('requires the events:replay permission', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- inspecting decorator metadata, never invoking
      const method = OutboxController.prototype.replaySince;
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual([
        'events:replay',
      ]);
    });
  });

  describe('findAll', () => {
    it('delegates to the query service', async () => {
      await controller.findAll({ page: 1, limit: 20 });

      expect(outboxQueryService.list).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });
  });
});
