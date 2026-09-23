import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { BrandAccessService } from '../../brands/services/brand-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeCapabilities,
  OpportunityAccessService,
  OpportunityAction,
  visibleOpportunitiesWhere,
} from './opportunity-access.service';

function buildUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'user@brand.com',
    isEmailVerified: true,
    isActive: true,
    roles: ['USER'],
    permissions: [],
    ...overrides,
  };
}

function buildOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    brandId: 'brand-a',
    createdById: 'creator-1',
    title: 'AW27 Knitwear',
    summary: null,
    status: 'DRAFT',
    metadata: {},
    latestVersionNumber: 0,
    lastPublishedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    brand: { isActive: true },
    members: [] as Array<{ role: string }>,
    ...overrides,
  };
}

describe('computeCapabilities', () => {
  const base = {
    brandRole: null,
    memberRole: null,
    isCreator: false,
    isPlatformAdmin: false,
  } as const;

  it('grants everything to a brand owner', () => {
    expect(computeCapabilities({ ...base, brandRole: 'OWNER' })).toEqual({
      view: true,
      edit: true,
      publish: true,
      share: true,
      manage: true,
    });
  });

  it('lets a brand editor edit but not publish unless they created it', () => {
    expect(computeCapabilities({ ...base, brandRole: 'EDITOR' })).toMatchObject(
      { view: true, edit: true, publish: false, share: false, manage: false },
    );
    expect(
      computeCapabilities({ ...base, brandRole: 'EDITOR', isCreator: true }),
    ).toMatchObject({ edit: true, publish: true, share: true, manage: true });
  });

  it('gives a brand viewer read-only access', () => {
    expect(computeCapabilities({ ...base, brandRole: 'VIEWER' })).toEqual({
      view: true,
      edit: false,
      publish: false,
      share: false,
      manage: false,
    });
  });

  it('lets an opportunity EDITOR collaborator edit without being a brand member', () => {
    expect(
      computeCapabilities({ ...base, memberRole: 'EDITOR' }),
    ).toMatchObject({ view: true, edit: true, publish: false });
  });

  it('gives an outsider nothing, even as the original creator', () => {
    expect(computeCapabilities({ ...base, isCreator: true })).toEqual({
      view: false,
      edit: false,
      publish: false,
      share: false,
      manage: false,
    });
  });

  it('gives platform admins read-only support access', () => {
    expect(
      computeCapabilities({ ...base, isPlatformAdmin: true }),
    ).toMatchObject({ view: true, edit: false, publish: false });
  });
});

describe('visibleOpportunitiesWhere', () => {
  it('scopes listing to the user memberships on active brands', () => {
    expect(visibleOpportunitiesWhere('user-1')).toEqual({
      OR: [
        { brand: { isActive: true, ownerId: 'user-1' } },
        { brand: { isActive: true, members: { some: { userId: 'user-1' } } } },
        { brand: { isActive: true }, members: { some: { userId: 'user-1' } } },
      ],
    });
  });
});

describe('OpportunityAccessService.authorize', () => {
  let prisma: { opportunity: { findUnique: ReturnType<typeof vi.fn> } };
  let brandAccess: { resolve: ReturnType<typeof vi.fn> };
  let service: OpportunityAccessService;

  beforeEach(() => {
    prisma = { opportunity: { findUnique: vi.fn() } };
    brandAccess = { resolve: vi.fn().mockResolvedValue(null) };
    service = new OpportunityAccessService(
      prisma as unknown as PrismaService,
      brandAccess as unknown as BrandAccessService,
    );
  });

  it('allows the brand owner and strips relation data from the result', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(buildOpportunity());
    brandAccess.resolve.mockResolvedValue({
      brandId: 'brand-a',
      ownerId: 'user-1',
      role: 'OWNER',
    });

    const context = await service.authorize(
      'opp-1',
      buildUser(),
      OpportunityAction.PUBLISH,
    );

    expect(context.capabilities.publish).toBe(true);
    expect(context.opportunity).not.toHaveProperty('members');
    expect(context.opportunity).not.toHaveProperty('brand');
  });

  it('allows an authorized collaborator', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      buildOpportunity({ members: [{ role: 'EDITOR' }] }),
    );

    const context = await service.authorize(
      'opp-1',
      buildUser({ id: 'designer-9' }),
      OpportunityAction.EDIT,
    );

    expect(context.memberRole).toBe('EDITOR');
  });

  it('returns 404 (not 403) to a user with no relationship, so IDs cannot be probed', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(buildOpportunity());

    await expect(
      service.authorize(
        'opp-1',
        buildUser({ id: 'stranger' }),
        OpportunityAction.VIEW,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects cross-organization access: an owner of brand B cannot open brand A opportunities', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      buildOpportunity({ brandId: 'brand-a' }),
    );
    // user-b owns brand-b only; for brand-a they resolve to no membership.
    brandAccess.resolve.mockImplementation((brandId: string) =>
      Promise.resolve(
        brandId === 'brand-b'
          ? { brandId: 'brand-b', ownerId: 'user-b', role: 'OWNER' }
          : null,
      ),
    );

    await expect(
      service.authorize(
        'opp-1',
        buildUser({ id: 'user-b' }),
        OpportunityAction.VIEW,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(brandAccess.resolve).toHaveBeenCalledWith('brand-a', 'user-b');
  });

  it('returns 404 for an unknown opportunity ID', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(null);

    await expect(
      service.authorize('missing', buildUser(), OpportunityAction.VIEW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 403 when the user can view but not perform the action', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(buildOpportunity());
    brandAccess.resolve.mockResolvedValue({
      brandId: 'brand-a',
      ownerId: 'owner',
      role: 'VIEWER',
    });

    await expect(
      service.authorize('opp-1', buildUser(), OpportunityAction.EDIT),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats archived opportunities as read-only', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      buildOpportunity({ archivedAt: new Date() }),
    );
    brandAccess.resolve.mockResolvedValue({
      brandId: 'brand-a',
      ownerId: 'user-1',
      role: 'OWNER',
    });

    await expect(
      service.authorize('opp-1', buildUser(), OpportunityAction.EDIT),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.authorize('opp-1', buildUser(), OpportunityAction.VIEW),
    ).resolves.toBeDefined();
    await expect(
      service.authorize('opp-1', buildUser(), OpportunityAction.MANAGE, {
        allowArchived: true,
      }),
    ).resolves.toBeDefined();
  });

  it('denies collaborators of a suspended brand', async () => {
    prisma.opportunity.findUnique.mockResolvedValue(
      buildOpportunity({
        brand: { isActive: false },
        members: [{ role: 'EDITOR' }],
      }),
    );

    await expect(
      service.authorize(
        'opp-1',
        buildUser({ id: 'designer-9' }),
        OpportunityAction.VIEW,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(brandAccess.resolve).not.toHaveBeenCalled();
  });
});
