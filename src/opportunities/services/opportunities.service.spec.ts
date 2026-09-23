import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { BrandAccessService } from '../../brands/services/brand-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityAccessService } from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDocumentService } from './opportunity-document.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'founder@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

function buildOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    brandId: 'brand-1',
    createdById: 'user-1',
    title: 'AW27 Knitwear',
    summary: null,
    status: 'DRAFT',
    metadata: {},
    latestVersionNumber: 0,
    lastPublishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OpportunitiesService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunity: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let brandAccess: { resolve: ReturnType<typeof vi.fn> };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let service: OpportunitiesService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
      opportunity: {
        create: vi.fn().mockResolvedValue(buildOpportunity()),
        findMany: vi.fn().mockResolvedValue([buildOpportunity()]),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(buildOpportunity()),
      },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
    };
    brandAccess = { resolve: vi.fn() };
    access = {
      authorize: vi.fn().mockResolvedValue({
        opportunity: buildOpportunity(),
        capabilities: {
          view: true,
          edit: true,
          publish: true,
          share: true,
          manage: true,
        },
      }),
    };
    service = new OpportunitiesService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      brandAccess as unknown as BrandAccessService,
      new OpportunityDocumentService(),
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
    );
  });

  describe('create', () => {
    it('creates the opportunity with a blank draft for a brand editor', async () => {
      brandAccess.resolve.mockResolvedValue({
        brandId: 'brand-1',
        ownerId: 'owner',
        role: 'EDITOR',
      });

      const result = await service.create(user, {
        brandId: 'brand-1',
        title: '  AW27 Knitwear  ',
      });

      expect(prisma.opportunity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brandId: 'brand-1',
          createdById: 'user-1',
          title: 'AW27 Knitwear',
          draft: {
            create: expect.objectContaining({
              format: 'blank',
              content: {},
            }) as unknown,
          },
        }) as unknown,
      });
      expect(prisma.opportunityActivity.create).toHaveBeenCalled();
      expect(result.capabilities).toMatchObject({ edit: true, publish: true });
    });

    it('creates with an initial structured document', async () => {
      brandAccess.resolve.mockResolvedValue({
        brandId: 'brand-1',
        ownerId: 'user-1',
        role: 'OWNER',
      });

      await service.create(user, {
        brandId: 'brand-1',
        title: 'AW27',
        document: {
          format: 'tiptap',
          schemaVersion: 1,
          content: { type: 'doc' },
        },
      });

      const { data } = prisma.opportunity.create.mock.calls[0][0] as {
        data: { draft: { create: { format: string } } };
      };
      expect(data.draft.create.format).toBe('tiptap');
    });

    it('forbids brand viewers', async () => {
      brandAccess.resolve.mockResolvedValue({
        brandId: 'brand-1',
        ownerId: 'owner',
        role: 'VIEWER',
      });

      await expect(
        service.create(user, { brandId: 'brand-1', title: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hides brands the user does not belong to (cross-organization)', async () => {
      brandAccess.resolve.mockResolvedValue(null);

      await expect(
        service.create(user, { brandId: 'other-brand', title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.opportunity.create).not.toHaveBeenCalled();
    });

    it('validates metadata with the same safety rules as documents', async () => {
      brandAccess.resolve.mockResolvedValue({
        brandId: 'brand-1',
        ownerId: 'user-1',
        role: 'OWNER',
      });

      await expect(
        service.create(user, {
          brandId: 'brand-1',
          title: 'x',
          metadata: { link: { href: 'javascript:alert(1)' } },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the caller memberships', async () => {
      await service.findAll(user, { page: 1, limit: 20 });

      const { where } = prisma.opportunity.findMany.mock.calls[0][0] as {
        where: { AND: Array<Record<string, unknown>> };
      };
      expect(JSON.stringify(where.AND[0])).toContain('"userId":"user-1"');
      expect(where.AND[1]).toMatchObject({ archivedAt: null });
    });

    it('lists archived opportunities only when asked', async () => {
      await service.findAll(user, { page: 1, limit: 20, status: 'ARCHIVED' });

      const { where } = prisma.opportunity.findMany.mock.calls[0][0] as {
        where: { AND: Array<Record<string, unknown>> };
      };
      expect(where.AND[1]).toMatchObject({ archivedAt: { not: null } });
    });
  });

  describe('update', () => {
    it('rejects an empty update', async () => {
      await expect(service.update('opp-1', user, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('records which fields changed, not their content', async () => {
      await service.update('opp-1', user, { title: 'New', summary: '' });

      expect(prisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: { title: 'New', summary: null },
      });
      expect(prisma.opportunityActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'UPDATED',
          metadata: { fields: ['title', 'summary'] },
        }) as unknown,
      });
    });
  });

  describe('restore', () => {
    it('restores to PUBLISHED when versions exist', async () => {
      access.authorize.mockResolvedValue({
        opportunity: buildOpportunity({
          archivedAt: new Date(),
          latestVersionNumber: 2,
        }),
        capabilities: {},
      });

      await service.restore('opp-1', user);

      expect(prisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: { archivedAt: null, status: 'PUBLISHED' },
      });
    });
  });
});
