import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDecisionsService } from './opportunity-decisions.service';

const user: AuthenticatedUser = {
  id: 'owner-1',
  email: 'owner@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

function buildDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'decision-1',
    opportunityId: 'opp-1',
    versionId: 'version-1',
    status: 'GO',
    rationale: 'The atelier portfolio matches the brief exactly.',
    decidedById: 'owner-1',
    decidedAt: new Date('2026-02-01T00:00:00.000Z'),
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('OpportunityDecisionsService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunityDecision: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    opportunityVersion: { findUnique: ReturnType<typeof vi.fn> };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let service: OpportunityDecisionsService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunityDecision: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(buildDecision(data)),
        ),
        findMany: vi.fn(),
      },
      opportunityVersion: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'version-1', versionNumber: 1 }),
      },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
    };
    access = { authorize: vi.fn().mockResolvedValue({}) };
    service = new OpportunityDecisionsService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
    );
  });

  describe('create', () => {
    it('records a GO decision pinned to the published version', async () => {
      const result = await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'GO',
        rationale: 'Strong portfolio match.',
      });

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.MANAGE,
      );
      expect(prisma.opportunityVersion.findUnique).toHaveBeenCalledWith({
        where: {
          opportunityId_versionNumber: {
            opportunityId: 'opp-1',
            versionNumber: 1,
          },
        },
        select: { id: true, versionNumber: true },
      });
      expect(prisma.opportunityDecision.create).toHaveBeenCalledWith({
        data: {
          opportunityId: 'opp-1',
          versionId: 'version-1',
          status: 'GO',
          rationale: 'Strong portfolio match.',
          decidedById: 'owner-1',
        },
      });
      expect(result).toMatchObject({
        status: 'GO',
        versionNumber: 1,
        rationale: 'Strong portfolio match.',
      });
    });

    it('records a HOLD decision', async () => {
      const result = await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'HOLD',
        rationale: 'Waiting on budget confirmation.',
      });
      expect(result.status).toBe('HOLD');
    });

    it('records a NO_GO decision', async () => {
      const result = await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'NO_GO',
        rationale: 'Scheduling conflict with the brand calendar.',
      });
      expect(result.status).toBe('NO_GO');
    });

    it('rejects a whitespace-only rationale', async () => {
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          status: 'GO',
          rationale: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.opportunityDecision.create).not.toHaveBeenCalled();
    });

    it('trims the rationale before storing it', async () => {
      await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'GO',
        rationale: '  Strong portfolio match.  ',
      });
      expect(prisma.opportunityDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rationale: 'Strong portfolio match.',
          }) as unknown,
        }),
      );
    });

    it('requires a published version — a nonexistent version number 404s', async () => {
      prisma.opportunityVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.create('opp-1', user, {
          versionNumber: 99,
          status: 'GO',
          rationale: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.opportunityDecision.create).not.toHaveBeenCalled();
    });

    it('rejects a decision against draft/unpublished content — only rows in opportunity_versions (never opportunity_drafts) can ever match', async () => {
      // The query only ever reads opportunityVersion — there is no code path
      // that could resolve a draft, so an opportunity that has draft edits
      // but no matching published versionNumber 404s the same way.
      prisma.opportunityVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          status: 'GO',
          rationale: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.opportunityDecision.create).not.toHaveBeenCalled();
    });

    it('rejects a version number that belongs to a different opportunity (compound-key lookup can never match it)', async () => {
      // The lookup is scoped by opportunityId AND versionNumber together, so
      // "version 1 of a different opportunity" simply cannot be found here —
      // proven by asserting the exact scoped query, same as the "not found" case.
      prisma.opportunityVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          status: 'GO',
          rationale: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.opportunityVersion.findUnique).toHaveBeenCalledWith({
        where: {
          opportunityId_versionNumber: {
            opportunityId: 'opp-1',
            versionNumber: 1,
          },
        },
        select: { id: true, versionNumber: true },
      });
    });

    it('rejects when the user lacks the required capability', async () => {
      access.authorize.mockRejectedValue(new ForbiddenException());
      await expect(
        service.create('opp-1', user, {
          versionNumber: 1,
          status: 'GO',
          rationale: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.opportunityVersion.findUnique).not.toHaveBeenCalled();
      expect(prisma.opportunityDecision.create).not.toHaveBeenCalled();
    });

    it('records an activity entry for the decision', async () => {
      await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'GO',
        rationale: 'x',
      });
      expect(prisma.opportunityActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DECISION_RECORDED',
          metadata: {
            decisionId: 'decision-1',
            status: 'GO',
            versionNumber: 1,
          },
        }) as unknown,
      });
    });
  });

  describe('list', () => {
    it('returns decision history newest first', async () => {
      prisma.opportunityDecision.findMany.mockResolvedValue([
        {
          ...buildDecision({ id: 'decision-2', status: 'HOLD' }),
          version: { versionNumber: 2 },
        },
        {
          ...buildDecision({ id: 'decision-1', status: 'GO' }),
          version: { versionNumber: 1 },
        },
      ]);

      const result = await service.list('opp-1', user);

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.MANAGE,
      );
      expect(prisma.opportunityDecision.findMany).toHaveBeenCalledWith({
        where: { opportunityId: 'opp-1' },
        include: { version: { select: { versionNumber: true } } },
        orderBy: { decidedAt: 'desc' },
      });
      expect(result.map((d) => d.id)).toEqual(['decision-2', 'decision-1']);
    });

    it('rejects unauthorized read access', async () => {
      access.authorize.mockRejectedValue(new ForbiddenException());
      await expect(service.list('opp-1', user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.opportunityDecision.findMany).not.toHaveBeenCalled();
    });
  });

  describe('immutability', () => {
    it('exposes no update or delete method — a second decision is a new record, not an edit', async () => {
      expect(
        (service as unknown as { update?: unknown }).update,
      ).toBeUndefined();
      expect(
        (service as unknown as { delete?: unknown }).delete,
      ).toBeUndefined();

      const first = await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'HOLD',
        rationale: 'Not ready yet.',
      });
      const second = await service.create('opp-1', user, {
        versionNumber: 1,
        status: 'GO',
        rationale: 'Budget confirmed.',
      });

      expect(prisma.opportunityDecision.create).toHaveBeenCalledTimes(2);
      expect(first.status).toBe('HOLD');
      expect(second.status).toBe('GO');
    });
  });
});
