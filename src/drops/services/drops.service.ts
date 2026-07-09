import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Drop, DropStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { DEFAULT_JOB_OPTIONS } from '../../common/queue/job-options.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDropDto } from '../dto/create-drop.dto';
import { ListDropsQueryDto } from '../dto/list-drops-query.dto';
import { ScheduleDropDto } from '../dto/schedule-drop.dto';
import { UpdateDropDto } from '../dto/update-drop.dto';
import { UpdateVisibilityDto } from '../dto/update-visibility.dto';
import { toDropResponse } from '../mappers/drop.mapper';
import {
  DropResponse,
  PaginatedDropsResponse,
} from '../types/drop-response.types';
import { slugify, withUniqueSuffix } from '../utils/slug.util';

export const DROPS_QUEUE = 'drops';
export const PUBLISH_DROP_JOB = 'publish-drop';

@Injectable()
export class DropsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DROPS_QUEUE) private readonly dropsQueue: Queue,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateDropDto,
  ): Promise<DropResponse> {
    await this.assertBrandOwnerOrAdmin(dto.brandId, user);

    if (dto.dealId) {
      const deal = await this.prisma.deal.findUnique({
        where: { id: dto.dealId },
      });

      if (!deal || deal.brandId !== dto.brandId) {
        throw new BadRequestException(
          'dealId must reference a deal belonging to the same brand',
        );
      }
    }

    const slug = await this.generateUniqueSlug(dto.title);

    const drop = await this.prisma.drop.create({
      data: {
        brandId: dto.brandId,
        dealId: dto.dealId,
        title: dto.title,
        description: dto.description,
        slug,
      },
    });

    return toDropResponse(drop);
  }

  async findMine(
    user: AuthenticatedUser,
    query: ListDropsQueryDto,
  ): Promise<PaginatedDropsResponse> {
    const ownedBrandIds = await this.prisma.brand.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    const where: Prisma.DropWhereInput = {
      brandId: { in: ownedBrandIds.map((brand) => brand.id) },
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    return this.paginate(where, query);
  }

  async findPublic(query: ListDropsQueryDto): Promise<PaginatedDropsResponse> {
    const where: Prisma.DropWhereInput = {
      status: DropStatus.PUBLISHED,
      visibility: 'PUBLIC',
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    return this.paginate(where, query);
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    return toDropResponse(drop);
  }

  async findBySlug(
    slug: string,
    user?: AuthenticatedUser,
  ): Promise<DropResponse> {
    const drop = await this.prisma.drop.findUnique({ where: { slug } });

    if (!drop) {
      throw new NotFoundException('Drop not found');
    }

    await this.assertViewable(drop, user);

    return toDropResponse(drop);
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateDropDto,
  ): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    if (drop.status === DropStatus.ARCHIVED) {
      throw new ConflictException('An archived drop cannot be edited');
    }

    const updated = await this.prisma.drop.update({
      where: { id },
      data: { title: dto.title, description: dto.description },
    });

    return toDropResponse(updated);
  }

  async schedule(
    id: string,
    user: AuthenticatedUser,
    dto: ScheduleDropDto,
  ): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    if (drop.status !== DropStatus.DRAFT) {
      throw new ConflictException('Only draft drops can be scheduled');
    }

    const publishAt = new Date(dto.publishAt);
    if (publishAt.getTime() <= Date.now()) {
      throw new BadRequestException('publishAt must be in the future');
    }

    const updated = await this.prisma.drop.update({
      where: { id },
      data: { status: DropStatus.SCHEDULED, publishAt },
    });

    await this.enqueuePublishJob(id, publishAt);

    return toDropResponse(updated);
  }

  async publish(id: string, user: AuthenticatedUser): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    if (
      drop.status !== DropStatus.DRAFT &&
      drop.status !== DropStatus.SCHEDULED
    ) {
      throw new ConflictException(
        'Only draft or scheduled drops can be published',
      );
    }

    const updated = await this.publishEntity(drop.id);
    return toDropResponse(updated);
  }

  async publishScheduled(id: string): Promise<void> {
    const drop = await this.prisma.drop.findUnique({ where: { id } });

    if (!drop || drop.status !== DropStatus.SCHEDULED) {
      return;
    }

    await this.publishEntity(id);
  }

  async archive(id: string, user: AuthenticatedUser): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    if (drop.status === DropStatus.ARCHIVED) {
      throw new ConflictException('This drop is already archived');
    }

    const updated = await this.prisma.drop.update({
      where: { id },
      data: { status: DropStatus.ARCHIVED, archivedAt: new Date() },
    });

    return toDropResponse(updated);
  }

  async updateVisibility(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateVisibilityDto,
  ): Promise<DropResponse> {
    const drop = await this.findEntityOrThrow(id);
    await this.assertOwnerOrAdmin(drop, user);

    const updated = await this.prisma.drop.update({
      where: { id },
      data: { visibility: dto.visibility },
    });

    return toDropResponse(updated);
  }

  async findEntityOrThrow(id: string): Promise<Drop> {
    const drop = await this.prisma.drop.findUnique({ where: { id } });

    if (!drop) {
      throw new NotFoundException('Drop not found');
    }

    return drop;
  }

  async assertOwnerOrAdmin(drop: Drop, user: AuthenticatedUser): Promise<void> {
    await this.assertBrandOwnerOrAdmin(drop.brandId, user);
  }

  async assertViewable(drop: Drop, user?: AuthenticatedUser): Promise<void> {
    const isPubliclyVisible =
      drop.status === DropStatus.PUBLISHED && drop.visibility !== 'PRIVATE';

    if (isPubliclyVisible) {
      return;
    }

    if (!user) {
      throw new NotFoundException('Drop not found');
    }

    await this.assertOwnerOrAdmin(drop, user);
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

  private async publishEntity(id: string): Promise<Drop> {
    return this.prisma.drop.update({
      where: { id },
      data: { status: DropStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  private async enqueuePublishJob(
    dropId: string,
    publishAt: Date,
  ): Promise<void> {
    const jobId = `${PUBLISH_DROP_JOB}-${dropId}`;
    const existing = await this.dropsQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }

    const delay = Math.max(publishAt.getTime() - Date.now(), 0);
    await this.dropsQueue.add(
      PUBLISH_DROP_JOB,
      { dropId },
      { ...DEFAULT_JOB_OPTIONS, jobId, delay },
    );
  }

  private async paginate(
    where: Prisma.DropWhereInput,
    query: ListDropsQueryDto,
  ): Promise<PaginatedDropsResponse> {
    const [drops, total] = await this.prisma.$transaction([
      this.prisma.drop.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.drop.count({ where }),
    ]);

    return {
      data: drops.map((drop) => toDropResponse(drop)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    const existing = await this.prisma.drop.findUnique({
      where: { slug: base },
    });

    if (!existing) {
      return base;
    }

    let candidate = withUniqueSuffix(base);
    while (await this.prisma.drop.findUnique({ where: { slug: candidate } })) {
      candidate = withUniqueSuffix(base);
    }

    return candidate;
  }
}
