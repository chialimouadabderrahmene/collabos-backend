import { Injectable } from '@nestjs/common';
import { PayoutStatus, Prisma, SplitStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PayoutReportQueryDto } from '../dto/payout-report-query.dto';
import { PayoutReportResponse } from '../types/payout-response.types';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    query: PayoutReportQueryDto,
  ): Promise<PayoutReportResponse> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const dateFilter =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined;

    const splitWhere: Prisma.PaymentSplitWhereInput = {
      recipientUserId: userId,
      isPlatformFee: false,
      status: SplitStatus.RELEASED,
      ...(dateFilter ? { releasedAt: dateFilter } : {}),
    };

    const payoutWhere: Prisma.PayoutWhereInput = {
      userId,
      status: PayoutStatus.PAID,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const [earned, withdrawn, payoutCount] = await Promise.all([
      this.prisma.paymentSplit.aggregate({
        where: splitWhere,
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: payoutWhere,
        _sum: { amount: true },
      }),
      this.prisma.payout.count({ where: payoutWhere }),
    ]);

    return {
      periodFrom: from ?? null,
      periodTo: to ?? null,
      totalEarned: earned._sum.amount ?? 0,
      totalWithdrawn: withdrawn._sum.amount ?? 0,
      payoutCount,
      currency: 'USD',
    };
  }
}
