import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { PushTokensService } from './push-tokens.service';

function buildToken(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'token-1',
    userId: 'user-1',
    token: 'device-token-abc',
    platform: 'IOS',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PushTokensService', () => {
  let prisma: {
    pushToken: {
      upsert: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: PushTokensService;

  beforeEach(() => {
    prisma = {
      pushToken: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new PushTokensService(prisma as unknown as PrismaService);
  });

  describe('register', () => {
    it('upserts by token so re-registering the same device does not duplicate rows', async () => {
      prisma.pushToken.upsert.mockResolvedValue(buildToken());

      await service.register('user-1', {
        token: 'device-token-abc',
        platform: 'IOS',
      });

      expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
        where: { token: 'device-token-abc' },
        create: {
          userId: 'user-1',
          token: 'device-token-abc',
          platform: 'IOS',
        },
        update: { userId: 'user-1', platform: 'IOS', isActive: true },
      });
    });
  });

  describe('findMine', () => {
    it('returns only active tokens for the user', async () => {
      prisma.pushToken.findMany.mockResolvedValue([buildToken()]);

      const result = await service.findMine('user-1');

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isActive: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('deactivate', () => {
    it('throws NotFoundException for a missing token', async () => {
      prisma.pushToken.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivate('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a token owned by another user', async () => {
      prisma.pushToken.findUnique.mockResolvedValue(buildToken());

      await expect(
        service.deactivate('token-1', 'stranger'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deactivates the token for its owner', async () => {
      prisma.pushToken.findUnique.mockResolvedValue(buildToken());

      await service.deactivate('token-1', 'user-1');

      expect(prisma.pushToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { isActive: false },
      });
    });
  });
});
