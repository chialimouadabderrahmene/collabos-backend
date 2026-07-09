import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushProviderService } from './push-provider.service';

describe('PushProviderService', () => {
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: PushProviderService;

  beforeEach(() => {
    configService = { get: vi.fn() };
    service = new PushProviderService(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('send', () => {
    it('does nothing when there are no tokens', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await service.send({ tokens: [], title: 'Hi', body: 'Body' });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('logs instead of calling out when no webhook is configured', async () => {
      configService.get.mockReturnValue(undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await service.send({ tokens: ['tok-1'], title: 'Hi', body: 'Body' });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts the dispatch payload to the configured webhook', async () => {
      configService.get.mockReturnValue('https://push.example.com/hook');
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', fetchMock);

      await service.send({ tokens: ['tok-1'], title: 'Hi', body: 'Body' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://push.example.com/hook',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws when the webhook responds with a non-ok status', async () => {
      configService.get.mockReturnValue('https://push.example.com/hook');
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        service.send({ tokens: ['tok-1'], title: 'Hi', body: 'Body' }),
      ).rejects.toThrow('Push provider webhook responded with status 500');
    });
  });
});
