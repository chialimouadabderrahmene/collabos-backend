import { Injectable } from '@nestjs/common';
import { ContractEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toEventResponse } from '../mappers/contract.mapper';
import { ContractEventResponse } from '../types/contract-response.types';

@Injectable()
export class ContractEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    contractId: string,
    type: ContractEventType,
    actorId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.contractEvent.create({
      data: {
        contractId,
        type,
        actorId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(contractId: string): Promise<ContractEventResponse[]> {
    const events = await this.prisma.contractEvent.findMany({
      where: { contractId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((event) => toEventResponse(event));
  }
}
