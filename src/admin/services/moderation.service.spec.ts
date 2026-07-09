import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from './moderation.service';

function buildReport(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'report-1',
    reporterId: 'user-1',
    targetType: 'BRAND',
    targetId: 'brand-1',
    reason: 'Inappropriate content',
    details: null,
    status: 'PENDING',
    reviewedById: null,
    actionTaken: null,
    resolutionNotes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    reviewedAt: null,
    ...overrides,
  };
}

describe('ModerationService', () => {
  let prisma: {
    contentReport: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: ModerationService;

  beforeEach(() => {
    prisma = {
      contentReport: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new ModerationService(prisma as unknown as PrismaService);
  });

  describe('fileReport', () => {
    it('creates a report scoped to the reporter', async () => {
      prisma.contentReport.create.mockResolvedValue(buildReport());

      await service.fileReport({ id: 'user-1', roles: ['USER'] } as never, {
        targetType: 'BRAND',
        targetId: 'brand-1',
        reason: 'Inappropriate content',
      });

      expect(prisma.contentReport.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user-1',
          targetType: 'BRAND',
          targetId: 'brand-1',
          reason: 'Inappropriate content',
          details: undefined,
        },
      });
    });
  });

  describe('listQueue', () => {
    it('returns a paginated queue', async () => {
      prisma.contentReport.findMany.mockResolvedValue([buildReport()]);
      prisma.contentReport.count.mockResolvedValue(1);

      const result = await service.listQueue({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('report-1');
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing report', async () => {
      prisma.contentReport.findUnique.mockResolvedValue(null);

      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('review', () => {
    it('resolves the report with the reviewing admin', async () => {
      prisma.contentReport.findUnique.mockResolvedValue(buildReport());
      prisma.contentReport.update.mockResolvedValue(
        buildReport({
          status: 'ACTIONED',
          actionTaken: 'SUSPEND',
          reviewedById: 'admin-1',
        }),
      );

      const result = await service.review(
        'report-1',
        { id: 'admin-1', roles: ['ADMIN'] } as never,
        { status: 'ACTIONED', actionTaken: 'SUSPEND' },
      );

      expect(prisma.contentReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
        }),
      );
      expect(result.status).toBe('ACTIONED');
      expect(result.reviewedById).toBe('admin-1');
    });

    it('throws NotFoundException when the report does not exist', async () => {
      prisma.contentReport.findUnique.mockResolvedValue(null);

      await expect(
        service.review(
          'missing',
          { id: 'admin-1', roles: ['ADMIN'] } as never,
          { status: 'DISMISSED' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
