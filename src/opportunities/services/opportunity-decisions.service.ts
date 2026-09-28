import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpportunityActivityType } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDecisionDto } from '../dto/publishing.dto';
import { toDecisionResponse } from '../mappers/opportunity.mapper';
import { DecisionResponse } from '../types/opportunity-response.types';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';

/**
 * R3 — Decision. The user, not the system, decides GO / HOLD / NO_GO;
 * this service only records that decision, always pinned to the exact
 * immutable published version it was made about (see ADR 0010).
 *
 * Immutable history, same as `opportunity_versions`: no update, no delete.
 * A changed mind is a new row, never an edit to the old one.
 */
@Injectable()
export class OpportunityDecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly activity: OpportunityActivityService,
  ) {}

  async create(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: CreateDecisionDto,
  ): Promise<DecisionResponse> {
    // Reuses the same authorization tier as publish/share/manage (see
    // OpportunityAccessService) — no new role or permission concept.
    await this.access.authorize(opportunityId, user, OpportunityAction.MANAGE);

    const rationale = dto.rationale.trim();
    if (!rationale) {
      throw new BadRequestException('Rationale is required');
    }

    // Scoping the lookup by BOTH opportunityId and versionNumber (the same
    // compound-unique query share links already use) is what guarantees the
    // version belongs to this opportunity and is actually published — a
    // draft, an arbitrary version ID, or another opportunity's version
    // number all simply fail to match and 404, with no separate check
    // needed.
    const version = await this.prisma.opportunityVersion.findUnique({
      where: {
        opportunityId_versionNumber: {
          opportunityId,
          versionNumber: dto.versionNumber,
        },
      },
      select: { id: true, versionNumber: true },
    });
    if (!version) {
      throw new NotFoundException('Published version not found');
    }

    const decision = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunityDecision.create({
        data: {
          opportunityId,
          versionId: version.id,
          status: dto.status,
          rationale,
          decidedById: user.id,
        },
      });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.DECISION_RECORDED,
        metadata: {
          decisionId: created.id,
          status: created.status,
          versionNumber: version.versionNumber,
        },
      });
      return created;
    });

    return toDecisionResponse(decision, version.versionNumber);
  }

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<DecisionResponse[]> {
    await this.access.authorize(opportunityId, user, OpportunityAction.MANAGE);

    const decisions = await this.prisma.opportunityDecision.findMany({
      where: { opportunityId },
      include: { version: { select: { versionNumber: true } } },
      orderBy: { decidedAt: 'desc' },
    });

    return decisions.map(({ version, ...decision }) =>
      toDecisionResponse(decision, version.versionNumber),
    );
  }
}
