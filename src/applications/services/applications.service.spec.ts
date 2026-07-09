import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationsService } from './applications.service';
import { NotificationsService } from './notifications.service';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'applicant-1',
    email: 'creator@example.com',
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
    title: 'Look-book photography',
    status: 'OPEN',
    brand: { id: 'brand-1', ownerId: 'owner-1' },
    ...overrides,
  };
}

function buildApplication(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'application-1',
    briefId: 'brief-1',
    applicantId: 'applicant-1',
    status: 'PENDING',
    coverMessage: 'I would love to work on this.',
    proposedBudget: null,
    decidedAt: null,
    withdrawnAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ApplicationsService', () => {
  let prisma: {
    brief: { findUnique: ReturnType<typeof vi.fn> };
    application: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let notificationsService: { create: ReturnType<typeof vi.fn> };
  let service: ApplicationsService;

  beforeEach(() => {
    prisma = {
      brief: { findUnique: vi.fn() },
      application: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    notificationsService = { create: vi.fn().mockResolvedValue(undefined) };
    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the brief does not exist', async () => {
      prisma.brief.findUnique.mockResolvedValue(null);

      await expect(
        service.create(buildUser(), {
          briefId: 'brief-1',
          coverMessage: 'I would love to work on this.',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the brief is not open', async () => {
      prisma.brief.findUnique.mockResolvedValue(
        buildBrief({ status: 'CLOSED' }),
      );

      await expect(
        service.create(buildUser(), {
          briefId: 'brief-1',
          coverMessage: 'I would love to work on this.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects the brand owner applying to their own brief', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.create(buildUser({ id: 'owner-1' }), {
          briefId: 'brief-1',
          coverMessage: 'I would love to work on this.',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a second active application from the same applicant', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.application.findFirst.mockResolvedValue(buildApplication());

      await expect(
        service.create(buildUser(), {
          briefId: 'brief-1',
          coverMessage: 'I would love to work on this.',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a pending application and notifies the brand owner', async () => {
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue(buildApplication());

      const result = await service.create(buildUser(), {
        briefId: 'brief-1',
        coverMessage: 'I would love to work on this.',
      });

      expect(result.status).toBe('PENDING');
      expect(notificationsService.create).toHaveBeenCalledWith(
        'owner-1',
        'APPLICATION_RECEIVED',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ briefId: 'brief-1' }),
      );
    });
  });

  describe('withdraw', () => {
    it('throws ForbiddenException for a non-applicant', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());

      await expect(
        service.withdraw('application-1', buildUser({ id: 'someone-else' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when not pending', async () => {
      prisma.application.findUnique.mockResolvedValue(
        buildApplication({ status: 'ACCEPTED' }),
      );

      await expect(
        service.withdraw('application-1', buildUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('withdraws a pending application and notifies the brand owner', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.application.update.mockResolvedValue(
        buildApplication({ status: 'WITHDRAWN', withdrawnAt: new Date() }),
      );
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      const result = await service.withdraw('application-1', buildUser());

      expect(result.status).toBe('WITHDRAWN');
      expect(notificationsService.create).toHaveBeenCalledWith(
        'owner-1',
        'APPLICATION_WITHDRAWN',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ applicationId: 'application-1' }),
      );
    });
  });

  describe('accept / reject', () => {
    it('rejects a non-owner, non-admin decision', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.accept('application-1', buildUser({ id: 'someone-else' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('accepts a pending application and notifies the applicant', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.application.update.mockResolvedValue(
        buildApplication({ status: 'ACCEPTED', decidedAt: new Date() }),
      );

      const result = await service.accept(
        'application-1',
        buildUser({ id: 'owner-1' }),
      );

      expect(result.status).toBe('ACCEPTED');
      expect(notificationsService.create).toHaveBeenCalledWith(
        'applicant-1',
        'APPLICATION_ACCEPTED',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('rejects a pending application and notifies the applicant', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());
      prisma.application.update.mockResolvedValue(
        buildApplication({ status: 'REJECTED', decidedAt: new Date() }),
      );

      const result = await service.reject(
        'application-1',
        buildUser({ id: 'owner-1' }),
      );

      expect(result.status).toBe('REJECTED');
      expect(notificationsService.create).toHaveBeenCalledWith(
        'applicant-1',
        'APPLICATION_REJECTED',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('throws ConflictException when deciding a non-pending application', async () => {
      prisma.application.findUnique.mockResolvedValue(
        buildApplication({ status: 'WITHDRAWN' }),
      );
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.accept('application-1', buildUser({ id: 'owner-1' })),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOneOrThrow', () => {
    it('allows the applicant', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.findOneOrThrow('application-1', buildUser()),
      ).resolves.toMatchObject({ id: 'application-1' });
    });

    it('allows the brand owner', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.findOneOrThrow('application-1', buildUser({ id: 'owner-1' })),
      ).resolves.toMatchObject({ id: 'application-1' });
    });

    it('rejects unrelated users', async () => {
      prisma.application.findUnique.mockResolvedValue(buildApplication());
      prisma.brief.findUnique.mockResolvedValue(buildBrief());

      await expect(
        service.findOneOrThrow('application-1', buildUser({ id: 'stranger' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
