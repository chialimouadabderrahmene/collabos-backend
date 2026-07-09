import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@brand.com',
    isEmailVerified: true,
    isActive: true,
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    bio: null,
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [{ name: 'USER' }],
    ...overrides,
  };
}

describe('UsersService', () => {
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated, mapped users', async () => {
      prisma.$transaction.mockResolvedValue([[buildUser()], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data[0]).toMatchObject({
        id: 'user-1',
        email: 'jane@brand.com',
        roles: ['USER'],
      });
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the mapped user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.findOneOrThrow('user-1');

      expect(result.email).toBe('jane@brand.com');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates and returns the mapped user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ isActive: false }));

      const result = await service.update('user-1', { isActive: false });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
        include: { roles: true },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('deactivates the user instead of hard-deleting', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ isActive: false }));

      const result = await service.remove('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
      expect(result.message).toBe('User deactivated');
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
