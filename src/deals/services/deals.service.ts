import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Deal, DealStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CancelDealDto } from '../dto/cancel-deal.dto';
import { CreateDealDto } from '../dto/create-deal.dto';
import { ListDealsQueryDto } from '../dto/list-deals-query.dto';
import { toDealResponse } from '../mappers/deal.mapper';
import {
  DealResponse,
  PaginatedDealsResponse,
} from '../types/deal-response.types';

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateDealDto,
  ): Promise<DealResponse> {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { brief: { include: { brand: true } }, deal: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'ACCEPTED') {
      throw new ConflictException(
        'A deal can only be created from an accepted application',
      );
    }

    if (application.deal) {
      throw new ConflictException('A deal already exists for this application');
    }

    const brand = application.brief.brand;
    const isBrandOwner = brand.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isBrandOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the brand owner can initiate a deal for this application',
      );
    }

    this.assertValidSplit(dto.revenueSplitBrand, dto.revenueSplitCreator);

    const deal = await this.prisma.deal.create({
      data: {
        applicationId: application.id,
        briefId: application.briefId,
        brandId: brand.id,
        creatorId: application.applicantId,
        title: dto.title ?? application.brief.title,
        totalValue: dto.totalValue,
        currency: dto.currency ?? 'USD',
        revenueSplitBrand: dto.revenueSplitBrand,
        revenueSplitCreator: dto.revenueSplitCreator,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        proposals: {
          create: {
            proposedById: user.id,
            totalValue: dto.totalValue,
            revenueSplitBrand: dto.revenueSplitBrand,
            revenueSplitCreator: dto.revenueSplitCreator,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            message: dto.message,
          },
        },
      },
    });

    return toDealResponse(deal);
  }

  async findAll(
    user: AuthenticatedUser,
    query: ListDealsQueryDto,
  ): Promise<PaginatedDealsResponse> {
    const ownedBrandIds = await this.prisma.brand.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    const where: Prisma.DealWhereInput = {
      OR: [
        { creatorId: user.id },
        { brandId: { in: ownedBrandIds.map((brand) => brand.id) } },
      ],
      ...(query.status ? { status: query.status } : {}),
    };

    const [deals, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        include: {
          milestones: { select: { dueDate: true, isCompleted: true } },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      data: deals.map((deal) => toDealResponse(deal, deal.milestones)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<DealResponse> {
    const deal = await this.findEntityOrThrow(id);
    await this.assertParticipant(deal, user);

    const milestones = await this.prisma.dealMilestone.findMany({
      where: { dealId: id },
      select: { dueDate: true, isCompleted: true },
    });

    return toDealResponse(deal, milestones);
  }

  async complete(id: string, user: AuthenticatedUser): Promise<DealResponse> {
    const deal = await this.findEntityOrThrow(id);
    await this.assertParticipant(deal, user);

    if (deal.status !== DealStatus.ACTIVE) {
      throw new ConflictException('Only active deals can be completed');
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { status: DealStatus.COMPLETED, completedAt: new Date() },
    });

    return toDealResponse(updated);
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
    dto: CancelDealDto,
  ): Promise<DealResponse> {
    const deal = await this.findEntityOrThrow(id);
    await this.assertParticipant(deal, user);

    if (
      deal.status === DealStatus.COMPLETED ||
      deal.status === DealStatus.CANCELLED
    ) {
      throw new ConflictException('This deal can no longer be cancelled');
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        status: DealStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
    });

    return toDealResponse(updated);
  }

  async findEntityOrThrow(id: string): Promise<Deal> {
    const deal = await this.prisma.deal.findUnique({ where: { id } });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return deal;
  }

  async assertParticipant(deal: Deal, user: AuthenticatedUser): Promise<void> {
    if (deal.creatorId === user.id || user.roles.includes('ADMIN')) {
      return;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: deal.brandId },
    });

    if (brand?.ownerId === user.id) {
      return;
    }

    throw new ForbiddenException('You do not have access to this deal');
  }

  assertValidSplit(brandSplit?: number, creatorSplit?: number): void {
    if (brandSplit === undefined && creatorSplit === undefined) {
      return;
    }

    if (brandSplit === undefined || creatorSplit === undefined) {
      throw new BadRequestException(
        'Both revenueSplitBrand and revenueSplitCreator must be provided together',
      );
    }

    if (brandSplit + creatorSplit !== 100) {
      throw new BadRequestException(
        'revenueSplitBrand and revenueSplitCreator must add up to 100',
      );
    }
  }
}
