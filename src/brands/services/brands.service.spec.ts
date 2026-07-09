import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brand-1',
    ownerId: 'user-1',
    name: 'Atelier Noir',
    slug: 'atelier-noir',
    logoUrl: null,
    coverUrl: null,
    isVerified: false,
    verifiedAt: null,
    followersCount: 0,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    profile: null,
    categories: [],
    ...overrides,
  };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@brand.com',
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
    ...overrides,
  };
}

describe('BrandsService', () => {
  let prisma: {
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: BrandsService;

  beforeEach(() => {
    prisma = {
      brand: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new BrandsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('generates a slug from the brand name when unique', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      prisma.brand.create.mockResolvedValue(buildBrand());

      await service.create('user-1', { name: 'Atelier Noir' });

      const createArgs = prisma.brand.create.mock.calls[0][0] as {
        data: { slug: string };
      };
      expect(createArgs.data.slug).toBe('atelier-noir');
    });

    it('appends a unique suffix when the slug is already taken', async () => {
      prisma.brand.findUnique
        .mockResolvedValueOnce(buildBrand())
        .mockResolvedValueOnce(null);
      prisma.brand.create.mockResolvedValue(buildBrand());

      await service.create('user-1', { name: 'Atelier Noir' });

      const createArgs = prisma.brand.create.mock.calls[0][0] as {
        data: { slug: string };
      };
      expect(createArgs.data.slug).toMatch(/^atelier-noir-[a-f0-9]{6}$/);
    });
  });

  describe('assertOwnerOrAdmin', () => {
    it('allows the owner', () => {
      expect(() =>
        service.assertOwnerOrAdmin('user-1', buildUser()),
      ).not.toThrow();
    });

    it('allows admins', () => {
      expect(() =>
        service.assertOwnerOrAdmin(
          'someone-else',
          buildUser({ roles: ['ADMIN'] }),
        ),
      ).not.toThrow();
    });

    it('rejects non-owner non-admins', () => {
      expect(() =>
        service.assertOwnerOrAdmin('someone-else', buildUser()),
      ).toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a missing or inactive brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', buildUser(), { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not the owner', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.update('brand-1', buildUser({ id: 'other-user' }), {
          name: 'New',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.brand.update).not.toHaveBeenCalled();
    });

    it('updates the brand when the requester is the owner', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brand.update.mockResolvedValue(buildBrand({ name: 'New Name' }));

      const result = await service.update('brand-1', buildUser(), {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });
  });

  describe('findAll', () => {
    it('only returns active brands and applies pagination', async () => {
      prisma.$transaction.mockResolvedValue([[buildBrand()], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].slug).toBe('atelier-noir');
    });
  });
});
