import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BrandMemberRole,
  OpportunityActivityType,
  OpportunityStatus,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { BrandAccessService } from '../../brands/services/brand-access.service';
import { brandRoleAtLeast } from '../../brands/utils/brand-role.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BLANK_DOCUMENT_FORMAT } from '../constants/opportunity.constants';
import {
  CreateOpportunityDto,
  ListOpportunitiesQueryDto,
  UpdateOpportunityDto,
} from '../dto/opportunity.dto';
import { toOpportunityResponse } from '../mappers/opportunity.mapper';
import {
  OpportunityResponse,
  PaginatedOpportunitiesResponse,
} from '../types/opportunity-response.types';
import {
  computeCapabilities,
  OpportunityAccessService,
  OpportunityAction,
  visibleOpportunitiesWhere,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDocumentService } from './opportunity-document.service';

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly brandAccess: BrandAccessService,
    private readonly documents: OpportunityDocumentService,
    private readonly activity: OpportunityActivityService,
  ) {}

  /** Creates the opportunity and its (initially blank or provided) draft. */
  async create(
    user: AuthenticatedUser,
    dto: CreateOpportunityDto,
  ): Promise<OpportunityResponse> {
    const brand = await this.brandAccess.resolve(dto.brandId, user.id);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    if (!brandRoleAtLeast(brand.role, BrandMemberRole.EDITOR)) {
      throw new ForbiddenException(
        'Only brand editors can create opportunities',
      );
    }

    const metadata = dto.metadata
      ? this.documents.validateMetadata(dto.metadata)
      : {};
    const document = dto.document
      ? this.documents.validateDocument(dto.document)
      : null;

    if (document && document.assetIds.length > 0) {
      throw new BadRequestException(
        'A new opportunity has no assets yet; upload assets before referencing them',
      );
    }

    const opportunity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          brandId: dto.brandId,
          createdById: user.id,
          title: dto.title.trim(),
          summary: dto.summary?.trim() || null,
          metadata,
          draft: {
            create: {
              format: document?.format ?? BLANK_DOCUMENT_FORMAT,
              schemaVersion: document?.schemaVersion ?? 1,
              content: document?.content ?? {},
              updatedById: user.id,
            },
          },
        },
      });

      await this.activity.record(tx, {
        opportunityId: created.id,
        actorId: user.id,
        type: OpportunityActivityType.CREATED,
        metadata: { brandId: dto.brandId },
      });

      return created;
    });

    return toOpportunityResponse(
      opportunity,
      computeCapabilities({
        brandRole: brand.role,
        memberRole: null,
        isCreator: true,
        isPlatformAdmin: user.roles.includes('ADMIN'),
      }),
    );
  }

  /** Lists only opportunities the user can see through brand membership or
   * a collaborator grant — never another tenant's. */
  async findAll(
    user: AuthenticatedUser,
    query: ListOpportunitiesQueryDto,
  ): Promise<PaginatedOpportunitiesResponse> {
    const isArchivedQuery = query.status === OpportunityStatus.ARCHIVED;
    const where: Prisma.OpportunityWhereInput = {
      AND: [
        visibleOpportunitiesWhere(user.id),
        {
          archivedAt: isArchivedQuery ? { not: null } : null,
          ...(query.status && !isArchivedQuery ? { status: query.status } : {}),
          ...(query.brandId ? { brandId: query.brandId } : {}),
          ...(query.search
            ? { title: { contains: query.search, mode: 'insensitive' } }
            : {}),
        },
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return {
      data: items.map((item) => toOpportunityResponse(item)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    const { opportunity, capabilities } = await this.access.authorize(
      id,
      user,
      OpportunityAction.VIEW,
    );
    return toOpportunityResponse(opportunity, capabilities);
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateOpportunityDto,
  ): Promise<OpportunityResponse> {
    const { capabilities } = await this.access.authorize(
      id,
      user,
      OpportunityAction.EDIT,
    );

    const data: Prisma.OpportunityUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.summary !== undefined) {
      data.summary = dto.summary.trim() || null;
    }
    if (dto.metadata !== undefined) {
      data.metadata = this.documents.validateMetadata(dto.metadata);
    }

    const fields = Object.keys(data);
    if (fields.length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.opportunity.update({ where: { id }, data });
      await this.activity.record(tx, {
        opportunityId: id,
        actorId: user.id,
        type: OpportunityActivityType.UPDATED,
        metadata: { fields },
      });
      return result;
    });

    return toOpportunityResponse(updated, capabilities);
  }

  /** Soft delete. Published versions stay intact (they are immutable) but
   * every share link stops resolving while the opportunity is archived. */
  async archive(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    const { capabilities } = await this.access.authorize(
      id,
      user,
      OpportunityAction.MANAGE,
    );

    const archived = await this.prisma.$transaction(async (tx) => {
      const result = await tx.opportunity.update({
        where: { id },
        data: { archivedAt: new Date(), status: OpportunityStatus.ARCHIVED },
      });
      await this.activity.record(tx, {
        opportunityId: id,
        actorId: user.id,
        type: OpportunityActivityType.ARCHIVED,
      });
      return result;
    });

    return toOpportunityResponse(archived, capabilities);
  }

  async restore(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OpportunityResponse> {
    const { opportunity, capabilities } = await this.access.authorize(
      id,
      user,
      OpportunityAction.MANAGE,
      { allowArchived: true },
    );

    if (!opportunity.archivedAt) {
      return toOpportunityResponse(opportunity, capabilities);
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      const result = await tx.opportunity.update({
        where: { id },
        data: {
          archivedAt: null,
          status:
            opportunity.latestVersionNumber > 0
              ? OpportunityStatus.PUBLISHED
              : OpportunityStatus.DRAFT,
        },
      });
      await this.activity.record(tx, {
        opportunityId: id,
        actorId: user.id,
        type: OpportunityActivityType.UPDATED,
        metadata: { action: 'restored' },
      });
      return result;
    });

    return toOpportunityResponse(restored, capabilities);
  }
}
