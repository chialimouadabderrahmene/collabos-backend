import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { assertBrandOwner } from './assert-brand-owner.util';

describe('assertBrandOwner', () => {
  it('throws NotFoundException when the brand does not exist', async () => {
    const prisma = { brand: { findUnique: vi.fn().mockResolvedValue(null) } };

    await expect(
      assertBrandOwner(prisma as unknown as PrismaService, 'brand-1', {
        id: 'user-1',
        roles: ['USER'],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException for a non-owner, non-admin user', async () => {
    const prisma = {
      brand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'brand-1', ownerId: 'owner-1' }),
      },
    };

    await expect(
      assertBrandOwner(prisma as unknown as PrismaService, 'brand-1', {
        id: 'stranger',
        roles: ['USER'],
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the brand for its owner', async () => {
    const brand = { id: 'brand-1', ownerId: 'owner-1', name: 'Acme' };
    const prisma = { brand: { findUnique: vi.fn().mockResolvedValue(brand) } };

    await expect(
      assertBrandOwner(prisma as unknown as PrismaService, 'brand-1', {
        id: 'owner-1',
        roles: ['USER'],
      } as never),
    ).resolves.toEqual(brand);
  });

  it('allows an admin who does not own the brand', async () => {
    const brand = { id: 'brand-1', ownerId: 'owner-1', name: 'Acme' };
    const prisma = { brand: { findUnique: vi.fn().mockResolvedValue(brand) } };

    await expect(
      assertBrandOwner(prisma as unknown as PrismaService, 'brand-1', {
        id: 'admin-1',
        roles: ['ADMIN'],
      } as never),
    ).resolves.toEqual(brand);
  });
});
