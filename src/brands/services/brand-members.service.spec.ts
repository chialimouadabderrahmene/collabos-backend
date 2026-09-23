import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandAccessService } from './brand-access.service';
import { BrandMembersService } from './brand-members.service';

function buildUser(id: string): AuthenticatedUser {
  return {
    id,
    email: `${id}@brand.com`,
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
  };
}

describe('BrandAccessService', () => {
  let prisma: { brand: { findUnique: ReturnType<typeof vi.fn> } };
  let service: BrandAccessService;

  beforeEach(() => {
    prisma = { brand: { findUnique: vi.fn() } };
    service = new BrandAccessService(prisma as unknown as PrismaService);
  });

  it('treats the legal owner as OWNER even without a member row', async () => {
    prisma.brand.findUnique.mockResolvedValue({
      id: 'brand-1',
      ownerId: 'owner',
      isActive: true,
      members: [],
    });

    await expect(service.resolve('brand-1', 'owner')).resolves.toMatchObject({
      role: 'OWNER',
    });
  });

  it('returns the member role for team members', async () => {
    prisma.brand.findUnique.mockResolvedValue({
      id: 'brand-1',
      ownerId: 'owner',
      isActive: true,
      members: [{ role: 'EDITOR' }],
    });

    await expect(service.resolve('brand-1', 'editor')).resolves.toMatchObject({
      role: 'EDITOR',
    });
  });

  it('grants nothing on unknown or suspended brands, or to outsiders', async () => {
    prisma.brand.findUnique.mockResolvedValue(null);
    await expect(service.resolve('x', 'u')).resolves.toBeNull();

    prisma.brand.findUnique.mockResolvedValue({
      id: 'brand-1',
      ownerId: 'owner',
      isActive: false,
      members: [],
    });
    await expect(service.resolve('brand-1', 'owner')).resolves.toBeNull();

    prisma.brand.findUnique.mockResolvedValue({
      id: 'brand-1',
      ownerId: 'owner',
      isActive: true,
      members: [],
    });
    await expect(service.resolve('brand-1', 'stranger')).resolves.toBeNull();
  });
});

describe('BrandMembersService', () => {
  let prisma: {
    user: { findFirst: ReturnType<typeof vi.fn> };
    brandMember: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let brandAccess: { resolve: ReturnType<typeof vi.fn> };
  let service: BrandMembersService;

  const asRole = (role: string) =>
    brandAccess.resolve.mockResolvedValue({
      brandId: 'brand-1',
      ownerId: 'owner',
      role,
    });

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'new-user', isActive: true }),
      },
      brandMember: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'm1',
            createdAt: new Date(),
            user: { email: 'new@x.io', displayName: null },
            ...data,
          }),
        ),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    brandAccess = { resolve: vi.fn() };
    service = new BrandMembersService(
      prisma as unknown as PrismaService,
      brandAccess as unknown as BrandAccessService,
    );
  });

  it('hides the brand from non-members', async () => {
    brandAccess.resolve.mockResolvedValue(null);

    await expect(
      service.list('brand-1', buildUser('stranger')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets an admin add an editor, matching the email case-insensitively', async () => {
    asRole('ADMIN');

    const member = await service.add('brand-1', buildUser('admin'), {
      email: 'New@X.io',
      role: 'EDITOR',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'New@X.io', mode: 'insensitive' } },
      }),
    );
    expect(member.role).toBe('EDITOR');
  });

  it('forbids editors from managing members', async () => {
    asRole('EDITOR');

    await expect(
      service.add('brand-1', buildUser('editor'), {
        email: 'a@b.c',
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids admins from granting ADMIN or OWNER', async () => {
    asRole('ADMIN');

    await expect(
      service.add('brand-1', buildUser('admin'), {
        email: 'a@b.c',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicates', async () => {
    asRole('OWNER');
    prisma.brandMember.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.add('brand-1', buildUser('owner'), {
        email: 'a@b.c',
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('never demotes or removes the legal owner', async () => {
    asRole('OWNER');
    prisma.brandMember.findUnique.mockResolvedValue({
      id: 'owner-row',
      userId: 'owner',
      role: 'OWNER',
    });

    await expect(
      service.updateRole('brand-1', 'owner', buildUser('co-owner'), {
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove('brand-1', 'owner', buildUser('co-owner')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets any member leave', async () => {
    asRole('VIEWER');
    prisma.brandMember.findUnique.mockResolvedValue({
      id: 'row',
      userId: 'viewer',
      role: 'VIEWER',
    });

    await expect(
      service.remove('brand-1', 'viewer', buildUser('viewer')),
    ).resolves.toEqual({ message: 'Member removed' });
  });
});
