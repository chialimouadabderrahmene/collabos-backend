import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brief, BriefStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBriefDto } from '../dto/create-brief.dto';
import { ListBriefsQueryDto } from '../dto/list-briefs-query.dto';
import { UpdateBriefDto } from '../dto/update-brief.dto';
import { toBriefResponse } from '../mappers/brief.mapper';
import {
  BriefResponse,
  MessageResponse,
  PaginatedBriefsResponse,
} from '../types/brief-response.types';

@Injectable()
export class BriefsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateBriefDto,
  ): Promise<BriefResponse> {
    await this.assertBrandOwnerOrAdmin(dto.brandId, user);
    this.assertFutureDeadline(dto.applicationDeadline);

    const brief = await this.prisma.brief.create({
      data: {
        brandId: dto.brandId,
        title: dto.title,
        description: dto.description,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency ?? 'USD',
        deliverables: dto.deliverables ?? [],
        applicationDeadline: dto.applicationDeadline
          ? new Date(dto.applicationDeadline)
          : undefined,
        location: dto.location,
        isRemote: dto.isRemote ?? true,
      },
    });

    return toBriefResponse(brief);
  }

  async findAll(query: ListBriefsQueryDto): Promise<PaginatedBriefsResponse> {
    const where: Prisma.BriefWhereInput = {
      status: query.status ? query.status : { in: ['OPEN', 'CLOSED'] },
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.isRemote !== undefined ? { isRemote: query.isRemote } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minBudget !== undefined
        ? { OR: [{ budgetMax: { gte: query.minBudget } }, { budgetMax: null }] }
        : {}),
      ...(query.maxBudget !== undefined
        ? { budgetMin: { lte: query.maxBudget } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brief.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brief.count({ where }),
    ]);

    return {
      data: data.map((brief) => toBriefResponse(brief)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<BriefResponse> {
    const brief = await this.findEntityOrThrow(id);
    return toBriefResponse(brief);
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateBriefDto,
  ): Promise<BriefResponse> {
    const existing = await this.findEntityOrThrow(id);
    await this.assertBrandOwnerOrAdmin(existing.brandId, user);

    if (existing.status !== BriefStatus.OPEN) {
      throw new ConflictException('Only open briefs can be edited');
    }

    this.assertFutureDeadline(dto.applicationDeadline);

    const brief = await this.prisma.brief.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        currency: dto.currency,
        deliverables: dto.deliverables,
        applicationDeadline: dto.applicationDeadline
          ? new Date(dto.applicationDeadline)
          : undefined,
        location: dto.location,
        isRemote: dto.isRemote,
      },
    });

    return toBriefResponse(brief);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<MessageResponse> {
    const existing = await this.findEntityOrThrow(id);
    await this.assertBrandOwnerOrAdmin(existing.brandId, user);

    await this.prisma.brief.delete({ where: { id } });

    return { message: 'Brief deleted' };
  }

  async close(id: string, user: AuthenticatedUser): Promise<BriefResponse> {
    const existing = await this.findEntityOrThrow(id);
    await this.assertBrandOwnerOrAdmin(existing.brandId, user);

    if (existing.status !== BriefStatus.OPEN) {
      throw new ConflictException('Only open briefs can be closed');
    }

    const brief = await this.prisma.brief.update({
      where: { id },
      data: { status: BriefStatus.CLOSED, closedAt: new Date() },
    });

    return toBriefResponse(brief);
  }

  async archive(id: string, user: AuthenticatedUser): Promise<BriefResponse> {
    const existing = await this.findEntityOrThrow(id);
    await this.assertBrandOwnerOrAdmin(existing.brandId, user);

    if (existing.status === BriefStatus.ARCHIVED) {
      throw new ConflictException('Brief is already archived');
    }

    const brief = await this.prisma.brief.update({
      where: { id },
      data: { status: BriefStatus.ARCHIVED, archivedAt: new Date() },
    });

    return toBriefResponse(brief);
  }

  private async findEntityOrThrow(id: string): Promise<Brief> {
    const brief = await this.prisma.brief.findUnique({ where: { id } });

    if (!brief) {
      throw new NotFoundException('Brief not found');
    }

    return brief;
  }

  private async assertBrandOwnerOrAdmin(
    brandId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand || !brand.isActive) {
      throw new NotFoundException('Brand not found');
    }

    const isOwner = brand.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this brand');
    }
  }

  private assertFutureDeadline(applicationDeadline?: string): void {
    if (!applicationDeadline) {
      return;
    }

    if (new Date(applicationDeadline).getTime() <= Date.now()) {
      throw new BadRequestException(
        'applicationDeadline must be in the future',
      );
    }
  }
}
