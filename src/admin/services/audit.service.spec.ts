import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

function buildLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    userId: 'user-1',
    action: 'LOGIN_SUCCESS',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AuditService', () => {
  let prisma: {
    auditLog: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: { findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(async (arg: unknown[]) => Promise.all(arg)),
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns a paginated list', async () => {
      prisma.auditLog.findMany.mockResolvedValue([buildLog()]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data[0].action).toBe('LOGIN_SUCCESS');
    });

    it('filters by userId, action, and date range', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        userId: 'user-1',
        action: 'LOGIN_FAILED',
        from: '2026-01-01',
        to: '2026-01-31',
      });

      const call = prisma.auditLog.findMany.mock.calls[0][0] as {
        where: {
          userId: string;
          action: string;
          createdAt: { gte: Date; lte: Date };
        };
      };
      expect(call.where.userId).toBe('user-1');
      expect(call.where.action).toBe('LOGIN_FAILED');
      expect(call.where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(call.where.createdAt.lte).toEqual(new Date('2026-01-31'));
    });
  });
});
