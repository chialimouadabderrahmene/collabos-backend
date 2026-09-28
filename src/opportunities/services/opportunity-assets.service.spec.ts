import {
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetUrlService } from './asset-url.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import {
  OpportunityAssetsService,
  sanitizeFilename,
} from './opportunity-assets.service';
import { OpportunityDocumentService } from './opportunity-document.service';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

const user: AuthenticatedUser = {
  id: 'editor-1',
  email: 'editor@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

function png(width = 800, height = 600): Buffer {
  const buffer = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function multerFile(
  buffer: Buffer,
  mimetype: string,
  originalname = 'sketch.png',
): Express.Multer.File {
  return {
    buffer,
    mimetype,
    originalname,
    size: buffer.length,
    fieldname: 'file',
    encoding: '7bit',
  } as Express.Multer.File;
}

describe('OpportunityAssetsService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunity: { update: ReturnType<typeof vi.fn> };
    opportunityAsset: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    opportunityDraft: { findUnique: ReturnType<typeof vi.fn> };
    opportunityVersionAsset: { count: ReturnType<typeof vi.fn> };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let storage: {
    upload: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getSignedUrl: ReturnType<typeof vi.fn>;
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let service: OpportunityAssetsService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunity: { update: vi.fn().mockResolvedValue({}) },
      opportunityAsset: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: ASSET_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...data,
          }),
        ),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      opportunityDraft: {
        findUnique: vi.fn().mockResolvedValue({ content: { type: 'doc' } }),
      },
      opportunityVersionAsset: { count: vi.fn().mockResolvedValue(0) },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
    };
    storage = {
      upload: vi.fn().mockResolvedValue({ key: 'k', url: 'u' }),
      delete: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue('https://signed.example/k'),
    };
    access = { authorize: vi.fn().mockResolvedValue({}) };
    const config = {
      get: vi.fn((key: string) =>
        key === 'opportunities.assetMaxSizeMb' ? 1 : 900,
      ),
    } as unknown as ConfigService;

    service = new OpportunityAssetsService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
      new OpportunityDocumentService(),
      new AssetUrlService(storage, config),
      config,
      storage,
    );
  });

  describe('upload', () => {
    it('stores an authorized, valid image under a server-generated key', async () => {
      const result = await service.upload(
        'opp-1',
        user,
        { kind: 'SKETCH' },
        multerFile(png(), 'image/png', '../../etc/passwd.png'),
      );

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.EDIT,
      );
      const { key } = storage.upload.mock.calls[0][0] as { key: string };
      expect(key).toMatch(/^opportunity-assets\/[0-9a-f-]{36}\.png$/);
      expect(key).not.toContain('opp-1');
      const { data } = prisma.opportunityAsset.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toMatchObject({
        kind: 'SKETCH',
        mimeType: 'image/png',
        width: 800,
        height: 600,
        originalFilename: 'passwd.png',
        uploadedById: 'editor-1',
      });
      expect(data.checksum).toMatch(/^[a-f0-9]{64}$/);
      // Storage keys never leave the API; only a signed URL and a reference.
      expect(result).not.toHaveProperty('storageKey');
      expect(result).toMatchObject({
        reference: `asset:${ASSET_ID}`,
        url: 'https://signed.example/k',
      });
    });

    it('rejects an unauthorized upload before storing anything', async () => {
      access.authorize.mockRejectedValue(new NotFoundException());

      await expect(
        service.upload(
          'opp-1',
          user,
          { kind: 'IMAGE' },
          multerFile(png(), 'image/png'),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects content that is not a supported image (e.g. SVG)', async () => {
      await expect(
        service.upload(
          'opp-1',
          user,
          { kind: 'IMAGE' },
          multerFile(Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml'),
        ),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a declared MIME type that does not match the content', async () => {
      await expect(
        service.upload(
          'opp-1',
          user,
          { kind: 'IMAGE' },
          multerFile(png(), 'image/jpeg'),
        ),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('accepts PDF only as a reference', async () => {
      const pdf = multerFile(
        Buffer.from('%PDF-1.7 ...'),
        'application/pdf',
        'brief.pdf',
      );

      await expect(
        service.upload('opp-1', user, { kind: 'IMAGE' }, pdf),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      await expect(
        service.upload('opp-1', user, { kind: 'REFERENCE' }, pdf),
      ).resolves.toMatchObject({ mimeType: 'application/pdf' });
    });

    it('rejects files over the size limit', async () => {
      const big = png();
      const file = { ...multerFile(big, 'image/png'), size: 2 * 1024 * 1024 };

      await expect(
        service.upload('opp-1', user, { kind: 'IMAGE' }, file),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('removes the stored object if the database write fails', async () => {
      prisma.opportunityAsset.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.upload(
          'opp-1',
          user,
          { kind: 'IMAGE' },
          multerFile(png(), 'image/png'),
        ),
      ).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledWith(
        (storage.upload.mock.calls[0][0] as { key: string }).key,
      );
    });
  });

  describe('remove', () => {
    const asset = {
      id: ASSET_ID,
      opportunityId: 'opp-1',
      storageKey: 'opportunities/opp-1/x.png',
    };

    it('only finds assets of the same opportunity', async () => {
      prisma.opportunityAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('opp-1', ASSET_ID, user),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.opportunityAsset.findFirst).toHaveBeenCalledWith({
        where: { id: ASSET_ID, opportunityId: 'opp-1', deletedAt: null },
      });
    });

    it('refuses while the draft still references the asset', async () => {
      prisma.opportunityAsset.findFirst.mockResolvedValue(asset);
      prisma.opportunityDraft.findUnique.mockResolvedValue({
        content: {
          type: 'doc',
          content: [{ type: 'image', attrs: { src: `asset:${ASSET_ID}` } }],
        },
      });

      await expect(
        service.remove('opp-1', ASSET_ID, user),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('keeps the stored object when a published version uses it', async () => {
      prisma.opportunityAsset.findFirst.mockResolvedValue(asset);
      prisma.opportunityVersionAsset.count.mockResolvedValue(1);

      await service.remove('opp-1', ASSET_ID, user);

      expect(prisma.opportunityAsset.update).toHaveBeenCalledWith({
        where: { id: ASSET_ID },
        data: { deletedAt: expect.any(Date) as unknown },
      });
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the stored object when nothing published uses it', async () => {
      prisma.opportunityAsset.findFirst.mockResolvedValue(asset);

      await service.remove('opp-1', ASSET_ID, user);

      expect(storage.delete).toHaveBeenCalledWith(asset.storageKey);
    });
  });
});

describe('sanitizeFilename', () => {
  it('strips directories and control characters', () => {
    expect(sanitizeFilename('C:\\Users\\x\\look\u0000book.png')).toBe(
      'lookbook.png',
    );
    expect(sanitizeFilename('   ')).toBeNull();
    expect(sanitizeFilename(undefined)).toBeNull();
  });
});
