import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { toMilestoneResponse } from '../mappers/deal.mapper';
import { MilestoneResponse } from '../types/deal-response.types';
import { DealsService } from './deals.service';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
  ) {}

  async create(
    dealId: string,
    user: AuthenticatedUser,
    dto: CreateMilestoneDto,
  ): Promise<MilestoneResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);
    this.assertMutable(deal.status);

    const milestone = await this.prisma.dealMilestone.create({
      data: {
        dealId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        position: dto.position ?? 0,
      },
    });

    return toMilestoneResponse(milestone);
  }

  async findAll(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<MilestoneResponse[]> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const milestones = await this.prisma.dealMilestone.findMany({
      where: { dealId },
      orderBy: [{ position: 'asc' }, { dueDate: 'asc' }],
    });

    return milestones.map((milestone) => toMilestoneResponse(milestone));
  }

  async complete(
    dealId: string,
    milestoneId: string,
    user: AuthenticatedUser,
  ): Promise<MilestoneResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const milestone = await this.findOrThrow(dealId, milestoneId);

    const updated = await this.prisma.dealMilestone.update({
      where: { id: milestone.id },
      data: { isCompleted: true, completedAt: new Date() },
    });

    return toMilestoneResponse(updated);
  }

  async remove(
    dealId: string,
    milestoneId: string,
    user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const milestone = await this.findOrThrow(dealId, milestoneId);
    await this.prisma.dealMilestone.delete({ where: { id: milestone.id } });

    return { message: 'Milestone removed' };
  }

  private async findOrThrow(dealId: string, milestoneId: string) {
    const milestone = await this.prisma.dealMilestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone || milestone.dealId !== dealId) {
      throw new NotFoundException('Milestone not found');
    }

    return milestone;
  }

  private assertMutable(status: DealStatus): void {
    if (status === DealStatus.COMPLETED || status === DealStatus.CANCELLED) {
      throw new ConflictException(
        'Milestones cannot be modified on a completed or cancelled deal',
      );
    }
  }
}
