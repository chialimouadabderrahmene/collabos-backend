import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageProvider } from './local-storage.provider';
import { StorageProvider } from './storage-provider.interface';
import { StorageController } from './storage.controller';

describe('StorageController', () => {
  let local: {
    verifySignedUrl: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
  let res: {
    setHeader: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    local = {
      verifySignedUrl: vi.fn().mockReturnValue(true),
      read: vi.fn().mockResolvedValue(Buffer.from('png-bytes')),
    };
    res = { setHeader: vi.fn(), send: vi.fn() };
  });

  function controller(activeProvider?: StorageProvider) {
    const provider = (activeProvider ?? local) as unknown as StorageProvider;
    return new StorageController(
      provider,
      local as unknown as LocalStorageProvider,
    );
  }

  it('serves a file behind a valid signature with safe headers', async () => {
    const expires = Date.now() + 60_000;

    await controller().serve(
      ['opportunities', 'opp-1', 'a.png'],
      String(expires),
      'sig',
      res as unknown as Response,
    );

    expect(local.verifySignedUrl).toHaveBeenCalledWith(
      'opportunities/opp-1/a.png',
      expires,
      'sig',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    );
    expect(res.send).toHaveBeenCalled();
  });

  it('404s on a bad signature, a missing signature, or when S3 is active', async () => {
    local.verifySignedUrl.mockReturnValue(false);
    await expect(
      controller().serve('a.png', '1', 'bad', res as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);

    local.verifySignedUrl.mockReturnValue(true);
    await expect(
      controller().serve('a.png', '1', undefined, res as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);

    const s3 = {} as StorageProvider;
    await expect(
      controller(s3).serve('a.png', '1', 'sig', res as unknown as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(local.read).not.toHaveBeenCalled();
  });

  it('404s when the file is missing', async () => {
    local.read.mockRejectedValue(new Error('ENOENT'));

    await expect(
      controller().serve(
        'a.png',
        String(Date.now() + 1000),
        'sig',
        res as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
