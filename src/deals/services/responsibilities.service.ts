import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResponsibilityDto } from '../dto/create-responsibility.dto';
import { toResponsibilityResponse } from '../mappers/deal.mapper';
import { ResponsibilityResponse } from '../types/deal-response.types';
import { DealsService } from './deals.service';

@Injectable()
export class ResponsibilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
  ) {}

  async create(
    dealId: string,
    user: AuthenticatedUser,
    dto: CreateResponsibilityDto,
  ): Promise<ResponsibilityResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);
    this.assertMutable(deal.status);

    const responsibility = await this.prisma.dealResponsibility.create({
      data: {
        dealId,
        party: dto.party,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    return toResponsibilityResponse(responsibility);
  }

  async findAll(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<ResponsibilityResponse[]> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const responsibilities = await this.prisma.dealResponsibility.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });

    return responsibilities.map((responsibility) =>
      toResponsibilityResponse(responsibility),
    );
  }

  async complete(
    dealId: string,
    responsibilityId: string,
    user: AuthenticatedUser,
  ): Promise<ResponsibilityResponse> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const responsibility = await this.findOrThrow(dealId, responsibilityId);

    const updated = await this.prisma.dealResponsibility.update({
      where: { id: responsibility.id },
      data: { isCompleted: true, completedAt: new Date() },
    });

    return toResponsibilityResponse(updated);
  }

  async remove(
    dealId: string,
    responsibilityId: string,
    user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const deal = await this.dealsService.findEntityOrThrow(dealId);
    await this.dealsService.assertParticipant(deal, user);

    const responsibility = await this.findOrThrow(dealId, responsibilityId);
    await this.prisma.dealResponsibility.delete({
      where: { id: responsibility.id },
    });

    return { message: 'Responsibility removed' };
  }

  private async findOrThrow(dealId: string, responsibilityId: string) {
    const responsibility = await this.prisma.dealResponsibility.findUnique({
      where: { id: responsibilityId },
    });

    if (!responsibility || responsibility.dealId !== dealId) {
      throw new NotFoundException('Responsibility not found');
    }

    return responsibility;
  }

  private assertMutable(status: DealStatus): void {
    if (status === DealStatus.COMPLETED || status === DealStatus.CANCELLED) {
      throw new ConflictException(
        'Responsibilities cannot be modified on a completed or cancelled deal',
      );
    }
  }
}
