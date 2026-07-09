import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { DealHealthResponse } from '../types/deal-response.types';
import { computeDealHealth } from '../utils/deal-health.util';
import { DealsService } from './deals.service';

@Injectable()
export class DealHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
  ) {}

  async getHealth(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<DealHealthResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const milestones = await this.prisma.dealMilestone.findMany({
      where: { dealId },
      select: { dueDate: true, isCompleted: true },
    });

    return { dealId, health: computeDealHealth(deal, milestones) };
  }
}
