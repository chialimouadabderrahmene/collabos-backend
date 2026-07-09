import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { BriefsService } from './briefs.service';

function buildBrand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brand-1',
    ownerId: 'user-1',
    isActive: true,
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

function buildBrief(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'brief-1',
    brandId: 'brand-1',
    title: 'Look-book photography',
    description: 'We need a photographer for our upcoming collection.',
    budgetMin: 500,
    budgetMax: 1500,
    currency: 'USD',
    deliverables: ['10 edited photos'],
    applicationDeadline: null,
    location: null,
    isRemote: true,
    status: 'OPEN',
    closedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BriefsService', () => {
  let prisma: {
    brief: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    brand: { findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: BriefsService;

  beforeEach(() => {
    prisma = {
      brief: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      brand: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    };
    service = new BriefsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('throws NotFoundException when the brand does not exist', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.create(buildUser(), {
          brandId: 'brand-1',
          title: 'Title',
          description: 'A description long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester does not own the brand', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.create(buildUser({ id: 'other-user' }), {
          brandId: 'brand-1',
          title: 'Title',
          description: 'A description long enough to pass validation.',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a deadline that is not in the future', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.create(buildUser(), {
          brandId: 'brand-1',
          title: 'Title',
          description: 'A description long enough to pass validation.',
          applicationDeadline: '2020-01-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a brief owned by the brand as OPEN', async () => {
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brief.create.mockResolvedValue(buildBrief());

      const result = await service.create(buildUser(), {
        brandId: 'brand-1',
        title: 'Look-book photography',
        description: 'We need a photographer for our upcoming collection.',
      });

      expect(result.status).toBe('OPEN');
    });
  });

  describe('update', () => {
    it('throws ConflictException when the brief is not open', async () => {
      prisma.brief.findUnique.mockResolvedValue(
        buildBrief({ status: 'CLOSED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.update('brief-1', buildUser(), { title: 'New title' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.brief.update).not.toHaveBeenCalled();
    });

    it('updates an open brief owned by the requester', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brief.update.mockResolvedValue(buildBrief({ title: 'New title' }));

      const result = await service.update('brief-1', buildUser(), {
        title: 'New title',
      });

      expect(result.title).toBe('New title');
    });
  });

  describe('close', () => {
    it('closes an open brief', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brief.update.mockResolvedValue(
        buildBrief({ status: 'CLOSED', closedAt: new Date() }),
      );

      const result = await service.close('brief-1', buildUser());

      expect(result.status).toBe('CLOSED');
    });

    it('rejects closing a brief that is already closed', async () => {
      prisma.brief.findUnique.mockResolvedValue(
        buildBrief({ status: 'CLOSED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.close('brief-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive', () => {
    it('archives an open or closed brief', async () => {
      prisma.brief.findUnique.mockResolvedValue(
        buildBrief({ status: 'CLOSED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brief.update.mockResolvedValue(
        buildBrief({ status: 'ARCHIVED', archivedAt: new Date() }),
      );

      const result = await service.archive('brief-1', buildUser());

      expect(result.status).toBe('ARCHIVED');
    });

    it('rejects archiving an already-archived brief', async () => {
      prisma.brief.findUnique.mockResolvedValue(
        buildBrief({ status: 'ARCHIVED' }),
      );
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.archive('brief-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException for a non-owner, non-admin requester', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());

      await expect(
        service.remove('brief-1', buildUser({ id: 'other-user' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.brief.delete).not.toHaveBeenCalled();
    });

    it('deletes the brief when the requester is an admin', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.brand.findUnique.mockResolvedValue(buildBrand());
      prisma.brief.delete.mockResolvedValue(buildBrief());

      const result = await service.remove(
        'brief-1',
        buildUser({ id: 'other-user', roles: ['ADMIN'] }),
      );

      expect(prisma.brief.delete).toHaveBeenCalledWith({
        where: { id: 'brief-1' },
      });
      expect(result.message).toBe('Brief deleted');
    });
  });

  describe('findAll', () => {
    it('excludes archived briefs by default', async () => {
      prisma.$transaction.mockResolvedValue([[buildBrief()], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      const findManyArgs = prisma.brief.findMany.mock.calls[0][0] as {
        where: { status: unknown };
      };
      expect(findManyArgs.where.status).toEqual({ in: ['OPEN', 'CLOSED'] });
      expect(result.total).toBe(1);
    });

    it('filters by an explicit status when provided', async () => {
      prisma.$transaction.mockResolvedValue([
        [buildBrief({ status: 'ARCHIVED' })],
        1,
      ]);

      await service.findAll({
        page: 1,
        limit: 20,
        status: 'ARCHIVED',
      });

      const findManyArgs = prisma.brief.findMany.mock.calls[0][0] as {
        where: { status: unknown };
      };
      expect(findManyArgs.where.status).toBe('ARCHIVED');
    });
  });
});
