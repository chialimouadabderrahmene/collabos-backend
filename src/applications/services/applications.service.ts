import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Application,
  ApplicationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from '../dto/create-application.dto';
import { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import { toApplicationResponse } from '../mappers/application.mapper';
import {
  ApplicationResponse,
  PaginatedApplicationsResponse,
} from '../types/application-response.types';
import { NotificationsService } from './notifications.service';

type BriefWithBrand = Prisma.BriefGetPayload<{ include: { brand: true } }>;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    const brief = await this.findBriefWithBrandOrThrow(dto.briefId);

    if (brief.status !== 'OPEN') {
      throw new ConflictException('This brief is not accepting applications');
    }

    if (brief.brand.ownerId === user.id) {
      throw new BadRequestException('You cannot apply to your own brief');
    }

    const existing = await this.prisma.application.findFirst({
      where: {
        briefId: dto.briefId,
        applicantId: user.id,
        status: { in: [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED] },
      },
    });

    if (existing) {
      throw new ConflictException(
        'You already have an active application for this brief',
      );
    }

    const application = await this.prisma.application.create({
      data: {
        briefId: dto.briefId,
        applicantId: user.id,
        coverMessage: dto.coverMessage,
        proposedBudget: dto.proposedBudget,
      },
    });

    await this.notificationsService.create(
      brief.brand.ownerId,
      NotificationType.APPLICATION_RECEIVED,
      'New application received',
      `${brief.title} received a new application.`,
      { briefId: brief.id, applicationId: application.id },
    );

    return toApplicationResponse(application);
  }

  async findMyApplications(
    userId: string,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponse> {
    return this.paginate(
      {
        applicantId: userId,
        ...(query.status ? { status: query.status } : {}),
      },
      query,
    );
  }

  async findBriefApplications(
    briefId: string,
    user: AuthenticatedUser,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponse> {
    const brief = await this.findBriefWithBrandOrThrow(briefId);
    this.assertBriefOwnerOrAdmin(brief, user);

    return this.paginate(
      { briefId, ...(query.status ? { status: query.status } : {}) },
      query,
    );
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    const application = await this.findEntityOrThrow(id);
    const brief = await this.findBriefWithBrandOrThrow(application.briefId);

    const isApplicant = application.applicantId === user.id;
    const isBrandOwner = brief.brand.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isApplicant && !isBrandOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have access to this application',
      );
    }

    return toApplicationResponse(application);
  }

  async withdraw(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    const application = await this.findEntityOrThrow(id);

    if (application.applicantId !== user.id) {
      throw new ForbiddenException(
        'You can only withdraw your own application',
      );
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException('Only pending applications can be withdrawn');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: ApplicationStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      },
    });

    const brief = await this.findBriefWithBrandOrThrow(application.briefId);
    await this.notificationsService.create(
      brief.brand.ownerId,
      NotificationType.APPLICATION_WITHDRAWN,
      'Applicant withdrew',
      `An applicant withdrew their application for ${brief.title}.`,
      { briefId: brief.id, applicationId: id },
    );

    return toApplicationResponse(updated);
  }

  async accept(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.decide(id, user, ApplicationStatus.ACCEPTED);
  }

  async reject(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApplicationResponse> {
    return this.decide(id, user, ApplicationStatus.REJECTED);
  }

  private async decide(
    id: string,
    user: AuthenticatedUser,
    nextStatus:
      typeof ApplicationStatus.ACCEPTED | typeof ApplicationStatus.REJECTED,
  ): Promise<ApplicationResponse> {
    const application = await this.findEntityOrThrow(id);
    const brief = await this.findBriefWithBrandOrThrow(application.briefId);
    this.assertBriefOwnerOrAdmin(brief, user);

    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException('Only pending applications can be decided');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: nextStatus, decidedAt: new Date() },
    });

    const notificationType =
      nextStatus === ApplicationStatus.ACCEPTED
        ? NotificationType.APPLICATION_ACCEPTED
        : NotificationType.APPLICATION_REJECTED;

    const notificationTitle =
      nextStatus === ApplicationStatus.ACCEPTED
        ? 'Application accepted'
        : 'Application rejected';

    await this.notificationsService.create(
      application.applicantId,
      notificationType,
      notificationTitle,
      `Your application for ${brief.title} was ${nextStatus.toLowerCase()}.`,
      { briefId: brief.id, applicationId: id },
    );

    return toApplicationResponse(updated);
  }

  private async paginate(
    where: Prisma.ApplicationWhereInput,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponse> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      data: data.map((application) => toApplicationResponse(application)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async findEntityOrThrow(id: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  private async findBriefWithBrandOrThrow(
    briefId: string,
  ): Promise<BriefWithBrand> {
    const brief = await this.prisma.brief.findUnique({
      where: { id: briefId },
      include: { brand: true },
    });

    if (!brief) {
      throw new NotFoundException('Brief not found');
    }

    return brief;
  }

  private assertBriefOwnerOrAdmin(
    brief: BriefWithBrand,
    user: AuthenticatedUser,
  ): void {
    const isOwner = brief.brand.ownerId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this brief');
    }
  }
}
