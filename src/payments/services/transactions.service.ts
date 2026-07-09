import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListTransactionsQueryDto } from '../dto/list-transactions-query.dto';
import { toTransactionResponse } from '../mappers/payment.mapper';
import { PaginatedTransactionsResponse } from '../types/payment-response.types';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    userId: string;
    type: TransactionType;
    amount: number;
    currency: string;
    paymentId?: string;
    description: string;
  }): Promise<void> {
    await this.prisma.transaction.create({
      data: {
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        currency: params.currency,
        paymentId: params.paymentId,
        description: params.description,
      },
    });
  }

  async findMine(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponse> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((transaction) =>
        toTransactionResponse(transaction),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
