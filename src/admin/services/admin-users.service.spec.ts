import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUsersService } from './admin-users.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'creator@example.com',
    displayName: 'Creator One',
    isActive: true,
    roles: [{ id: 'role-1', name: 'USER' }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AdminUsersService', () => {
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    role: { findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: AdminUsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      role: { findMany: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new AdminUsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns a paginated, mapped list', async () => {
      prisma.user.findMany.mockResolvedValue([buildUser()]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].roles).toEqual(['USER']);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('suspend', () => {
    it('deactivates the user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ isActive: false }));

      const result = await service.suspend('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('reactivate', () => {
    it('reactivates the user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      prisma.user.update.mockResolvedValue(buildUser({ isActive: true }));

      const result = await service.reactivate('user-1');

      expect(result.isActive).toBe(true);
    });
  });

  describe('setRoles', () => {
    it('throws BadRequestException for an unknown role', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.role.findMany.mockResolvedValue([{ id: 'role-1', name: 'USER' }]);

      await expect(
        service.setRoles('user-1', { roles: ['USER', 'GHOST'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces the roles when every name is valid', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.role.findMany.mockResolvedValue([
        { id: 'role-1', name: 'USER' },
        { id: 'role-2', name: 'ADMIN' },
      ]);
      prisma.user.update.mockResolvedValue(
        buildUser({
          roles: [
            { id: 'role-1', name: 'USER' },
            { id: 'role-2', name: 'ADMIN' },
          ],
        }),
      );

      const result = await service.setRoles('user-1', {
        roles: ['USER', 'ADMIN'],
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { roles: { set: [{ id: 'role-1' }, { id: 'role-2' }] } },
        }),
      );
      expect(result.roles).toEqual(['USER', 'ADMIN']);
    });
  });
});
