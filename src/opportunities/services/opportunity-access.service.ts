import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BrandMemberRole,
  Opportunity,
  OpportunityMemberRole,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { BrandAccessService } from '../../brands/services/brand-access.service';
import { brandRoleAtLeast } from '../../brands/utils/brand-role.util';
import { PrismaService } from '../../prisma/prisma.service';

export enum OpportunityAction {
  VIEW = 'view',
  EDIT = 'edit',
  PUBLISH = 'publish',
  SHARE = 'share',
  MANAGE = 'manage',
}

export interface OpportunityCapabilities {
  view: boolean;
  edit: boolean;
  publish: boolean;
  share: boolean;
  manage: boolean;
}

export interface OpportunityAccessInput {
  brandRole: BrandMemberRole | null;
  memberRole: OpportunityMemberRole | null;
  isCreator: boolean;
  isPlatformAdmin: boolean;
}

export interface OpportunityAccessContext extends OpportunityAccessInput {
  opportunity: Opportunity;
  capabilities: OpportunityCapabilities;
}

/**
 * Permission matrix (pure, unit-tested):
 * - view:    any brand member, any opportunity collaborator, platform ADMIN
 *            (read-only support access);
 * - edit:    brand EDITOR+ or opportunity EDITOR collaborator;
 * - publish/share/manage: brand ADMIN+, or the opportunity creator while they
 *            still hold edit access.
 * Losing brand membership removes every right, including the creator's.
 */
export function computeCapabilities(
  input: OpportunityAccessInput,
): OpportunityCapabilities {
  const isMember = input.brandRole !== null || input.memberRole !== null;
  const edit =
    brandRoleAtLeast(input.brandRole, BrandMemberRole.EDITOR) ||
    input.memberRole === OpportunityMemberRole.EDITOR;
  const control =
    brandRoleAtLeast(input.brandRole, BrandMemberRole.ADMIN) ||
    (input.isCreator && edit);

  return {
    view: isMember || input.isPlatformAdmin,
    edit,
    publish: control,
    share: control,
    manage: control,
  };
}

/** Prisma filter selecting the opportunities a user can see (tenant scoped). */
export function visibleOpportunitiesWhere(
  userId: string,
): Prisma.OpportunityWhereInput {
  return {
    OR: [
      { brand: { isActive: true, ownerId: userId } },
      { brand: { isActive: true, members: { some: { userId } } } },
      { brand: { isActive: true }, members: { some: { userId } } },
    ],
  };
}

@Injectable()
export class OpportunityAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAccess: BrandAccessService,
  ) {}

  /**
   * Loads the opportunity and asserts `action` for `user`.
   * - no view right (or unknown ID) → 404, so IDs cannot be probed across
   *   brands;
   * - view but not `action` → 403;
   * - archived and `action` is not VIEW → 409 (archived is read-only),
   *   unless `allowArchived` (used by restore).
   */
  async authorize(
    opportunityId: string,
    user: AuthenticatedUser,
    action: OpportunityAction,
    options: { allowArchived?: boolean } = {},
  ): Promise<OpportunityAccessContext> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        brand: { select: { isActive: true } },
        members: { where: { userId: user.id }, select: { role: true } },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const { members, brand, ...plain } = opportunity;
    // Suspended brands grant nothing, to members or collaborators alike.
    const brandAccess = brand.isActive
      ? await this.brandAccess.resolve(plain.brandId, user.id)
      : null;
    const input: OpportunityAccessInput = {
      brandRole: brandAccess?.role ?? null,
      memberRole: brand.isActive ? (members[0]?.role ?? null) : null,
      isCreator: plain.createdById === user.id,
      isPlatformAdmin: user.roles.includes('ADMIN'),
    };
    const capabilities = computeCapabilities(input);

    if (!capabilities.view) {
      throw new NotFoundException('Opportunity not found');
    }

    if (!capabilities[action]) {
      throw new ForbiddenException(
        'You do not have permission to perform this action on this opportunity',
      );
    }

    if (
      plain.archivedAt &&
      action !== OpportunityAction.VIEW &&
      !options.allowArchived
    ) {
      throw new ConflictException('Opportunity is archived');
    }

    return { ...input, opportunity: plain, capabilities };
  }
}
