import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpportunityActivityType } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AddOpportunityMemberDto } from '../dto/opportunity.dto';
import {
  MessageResponse,
  OpportunityMemberResponse,
} from '../types/opportunity-response.types';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';

const MEMBER_USER_SELECT = { email: true, displayName: true } as const;

/** Per-opportunity collaborators (e.g. an external designer) on top of the
 * brand team. Managed by brand admins or the opportunity creator. */
@Injectable()
export class OpportunityMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly activity: OpportunityActivityService,
  ) {}

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<OpportunityMemberResponse[]> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const members = await this.prisma.opportunityMember.findMany({
      where: { opportunityId },
      include: { user: { select: MEMBER_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role,
      createdAt: member.createdAt,
    }));
  }

  async add(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: AddOpportunityMemberDto,
  ): Promise<OpportunityMemberResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.MANAGE);

    const target = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
      select: { id: true, isActive: true },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.opportunityMember.findUnique({
      where: { opportunityId_userId: { opportunityId, userId: target.id } },
    });
    if (existing) {
      throw new ConflictException('User is already a collaborator');
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunityMember.create({
        data: {
          opportunityId,
          userId: target.id,
          role: dto.role,
          addedById: user.id,
        },
        include: { user: { select: MEMBER_USER_SELECT } },
      });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.MEMBER_ADDED,
        metadata: { userId: target.id, role: dto.role },
      });
      return created;
    });

    return {
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      role: member.role,
      createdAt: member.createdAt,
    };
  }

  /** Managers can remove anyone; a collaborator can always remove themself. */
  async remove(
    opportunityId: string,
    memberUserId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.access.authorize(
      opportunityId,
      user,
      memberUserId === user.id
        ? OpportunityAction.VIEW
        : OpportunityAction.MANAGE,
    );

    const member = await this.prisma.opportunityMember.findUnique({
      where: { opportunityId_userId: { opportunityId, userId: memberUserId } },
    });
    if (!member) {
      throw new NotFoundException('Collaborator not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.opportunityMember.delete({ where: { id: member.id } });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.MEMBER_REMOVED,
        metadata: { userId: memberUserId },
      });
    });

    return { message: 'Collaborator removed' };
  }
}
