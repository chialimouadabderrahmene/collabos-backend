import { Injectable } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceResponse } from '../types/payout-response.types';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<BalanceResponse> {
    const [earned, pending, paid] = await Promise.all([
      this.prisma.paymentSplit.aggregate({
        where: {
          recipientUserId: userId,
          isPlatformFee: false,
          status: 'RELEASED',
        },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          userId,
          status: { in: [PayoutStatus.PENDING, PayoutStatus.IN_TRANSIT] },
        },
        _sum: { amount: true },
      }),
      this.prisma.payout.aggregate({
        where: { userId, status: PayoutStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    const totalEarned = earned._sum.amount ?? 0;
    const pendingWithdrawals = pending._sum.amount ?? 0;
    const totalWithdrawn = paid._sum.amount ?? 0;
    const available = totalEarned - pendingWithdrawals - totalWithdrawn;

    return {
      available,
      pendingWithdrawals,
      totalWithdrawn,
      totalEarned,
      currency: 'USD',
    };
  }
}
