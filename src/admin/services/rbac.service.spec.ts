import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let prisma: {
    permission: { findMany: ReturnType<typeof vi.fn> };
    role: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: RbacService;

  beforeEach(() => {
    prisma = {
      permission: { findMany: vi.fn() },
      role: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new RbacService(prisma as unknown as PrismaService);
  });

  describe('listPermissions', () => {
    it('maps every permission row', async () => {
      prisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1', name: 'users:manage' },
      ]);

      const result = await service.listPermissions();

      expect(result).toEqual([{ id: 'perm-1', name: 'users:manage' }]);
    });
  });

  describe('listRoles', () => {
    it('maps roles with their permission names', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          name: 'ADMIN',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          permissions: [{ id: 'perm-1', name: 'users:manage' }],
        },
      ]);

      const result = await service.listRoles();

      expect(result[0].permissions).toEqual(['users:manage']);
    });
  });

  describe('createRole', () => {
    it('rejects a duplicate role name', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });

      await expect(service.createRole({ name: 'X' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('creates a new role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({
        id: 'role-2',
        name: 'BRAND_MODERATOR',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        permissions: [],
      });

      const result = await service.createRole({ name: 'BRAND_MODERATOR' });

      expect(result.name).toBe('BRAND_MODERATOR');
    });
  });

  describe('setRolePermissions', () => {
    it('throws when the role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.setRolePermissions('missing', { permissions: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when a requested permission name is unknown', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });
      prisma.permission.findMany.mockResolvedValue([]);

      await expect(
        service.setRolePermissions('role-1', { permissions: ['nope'] }),
      ).rejects.toThrow(/Unknown permission/);
    });

    it('replaces the role permission set', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'X' });
      prisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1', name: 'users:manage' },
      ]);
      prisma.role.update.mockResolvedValue({
        id: 'role-1',
        name: 'X',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        permissions: [{ id: 'perm-1', name: 'users:manage' }],
      });

      const result = await service.setRolePermissions('role-1', {
        permissions: ['users:manage'],
      });

      expect(result.permissions).toEqual(['users:manage']);
      const call = prisma.role.update.mock.calls[0][0] as {
        data: { permissions: { set: { id: string }[] } };
      };
      expect(call.data.permissions.set).toEqual([{ id: 'perm-1' }]);
    });
  });
});
