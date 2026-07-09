import { Injectable } from '@nestjs/common';
import { Prisma, SplitStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListTransfersQueryDto } from '../dto/list-transfers-query.dto';
import { toTransferResponse } from '../mappers/payout.mapper';
import { PaginatedTransfersResponse } from '../types/payout-response.types';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    userId: string,
    query: ListTransfersQueryDto,
  ): Promise<PaginatedTransfersResponse> {
    const where: Prisma.PaymentSplitWhereInput = {
      recipientUserId: userId,
      isPlatformFee: false,
      status: SplitStatus.RELEASED,
    };

    const [splits, total] = await this.prisma.$transaction([
      this.prisma.paymentSplit.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { releasedAt: 'desc' },
      }),
      this.prisma.paymentSplit.count({ where }),
    ]);

    return {
      data: splits.map((split) => toTransferResponse(split)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
