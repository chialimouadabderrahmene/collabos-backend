import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListOutboxQueryDto } from './dto/list-outbox-query.dto';
import { toOutboxEventResponse } from './mappers/outbox-event.mapper';
import {
  OutboxEventResponse,
  PaginatedOutboxEventsResponse,
} from './types/outbox-event-response.types';

@Injectable()
export class OutboxQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListOutboxQueryDto,
  ): Promise<PaginatedOutboxEventsResponse> {
    const where: Prisma.OutboxEventWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [events, total] = await this.prisma.$transaction([
      this.prisma.outboxEvent.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);

    return {
      data: events.map((event) => toOutboxEventResponse(event)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(id: string): Promise<OutboxEventResponse> {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Outbox event not found');
    }

    return toOutboxEventResponse(event);
  }
}
