import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentReport, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { FileReportDto } from '../dto/file-report.dto';
import { ListReportsQueryDto } from '../dto/list-reports-query.dto';
import { ReviewReportDto } from '../dto/review-report.dto';
import { toContentReportResponse } from '../mappers/admin.mapper';
import {
  ContentReportResponse,
  PaginatedContentReportsResponse,
} from '../types/admin-response.types';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async fileReport(
    user: AuthenticatedUser,
    dto: FileReportDto,
  ): Promise<ContentReportResponse> {
    const report = await this.prisma.contentReport.create({
      data: {
        reporterId: user.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details,
      },
    });

    return toContentReportResponse(report);
  }

  async listQueue(
    query: ListReportsQueryDto,
  ): Promise<PaginatedContentReportsResponse> {
    const where: Prisma.ContentReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.contentReport.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contentReport.count({ where }),
    ]);

    return {
      data: reports.map((report) => toContentReportResponse(report)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<ContentReportResponse> {
    const report = await this.getEntityOrThrow(id);
    return toContentReportResponse(report);
  }

  async review(
    id: string,
    admin: AuthenticatedUser,
    dto: ReviewReportDto,
  ): Promise<ContentReportResponse> {
    await this.getEntityOrThrow(id);

    const report = await this.prisma.contentReport.update({
      where: { id },
      data: {
        status: dto.status,
        actionTaken: dto.actionTaken,
        resolutionNotes: dto.resolutionNotes,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    return toContentReportResponse(report);
  }

  private async getEntityOrThrow(id: string): Promise<ContentReport> {
    const report = await this.prisma.contentReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }
}
