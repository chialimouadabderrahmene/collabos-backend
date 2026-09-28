import { Injectable, Logger } from '@nestjs/common';
import { OpportunityActivityType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { toActivityResponse } from '../mappers/opportunity.mapper';
import { PaginatedActivityResponse } from '../types/opportunity-response.types';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';

export interface RecordActivityParams {
  opportunityId: string;
  actorId: string;
  type: OpportunityActivityType;
  /** Identifiers and field names only — never document content or tokens. */
  metadata?: Prisma.InputJsonObject;
}

/**
 * Opportunity activity feed + structured log line for every important
 * lifecycle event. `record` accepts a transaction client so the activity row
 * commits atomically with the change it describes.
 */
@Injectable()
export class OpportunityActivityService {
  private readonly logger = new Logger('OpportunityActivity');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
  ) {}

  async record(
    client: Prisma.TransactionClient,
    params: RecordActivityParams,
  ): Promise<void> {
    await client.opportunityActivity.create({
      data: {
        opportunityId: params.opportunityId,
        actorId: params.actorId,
        type: params.type,
        metadata: params.metadata,
      },
    });

    this.logger.log(
      `${params.type} opportunity=${params.opportunityId} actor=${params.actorId}${
        params.metadata ? ` ${JSON.stringify(params.metadata)}` : ''
      }`,
    );
  }

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedActivityResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunityActivity.findMany({
        where: { opportunityId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.opportunityActivity.count({ where: { opportunityId } }),
    ]);

    return {
      data: items.map(toActivityResponse),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
