import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectAccountStatus,
  Prisma,
  PayoutStatus,
  TransactionType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { ListPayoutsQueryDto } from '../dto/list-payouts-query.dto';
import { toPayoutResponse } from '../mappers/payout.mapper';
import {
  PaginatedPayoutsResponse,
  PayoutResponse,
} from '../types/payout-response.types';
import { BalanceService } from './balance.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly balanceService: BalanceService,
  ) {}

  async withdraw(
    user: AuthenticatedUser,
    dto: CreateWithdrawalDto,
  ): Promise<PayoutResponse> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId: user.id },
    });

    if (!account) {
      throw new NotFoundException(
        'Connect a payout account before withdrawing',
      );
    }

    if (account.status !== ConnectAccountStatus.ACTIVE) {
      throw new ConflictException('Your payout account is not yet active');
    }

    const balance = await this.balanceService.getBalance(user.id);
    const amount = dto.amount ?? balance.available;

    if (amount <= 0) {
      throw new BadRequestException('Nothing available to withdraw');
    }

    if (amount > balance.available) {
      throw new ConflictException('Requested amount exceeds available balance');
    }

    const minimumAmount =
      this.configService.get<number>('payouts.minimumAmount') ?? 20;

    if (amount < minimumAmount) {
      throw new BadRequestException(
        `Minimum withdrawal amount is ${minimumAmount}`,
      );
    }

    const payout = await this.prisma.payout.create({
      data: {
        userId: user.id,
        stripeAccountId: account.stripeAccountId,
        amount,
        currency: balance.currency,
        status: PayoutStatus.PENDING,
      },
    });

    try {
      const stripePayout = await this.stripeService.createPayout({
        amount: this.toMinorUnits(amount),
        currency: balance.currency,
        stripeAccountId: account.stripeAccountId,
        metadata: { payoutId: payout.id, userId: user.id },
      });

      const updated = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          stripePayoutId: stripePayout.id,
          status: this.mapStripeStatus(stripePayout.status),
        },
      });

      await this.prisma.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.PAYOUT,
          amount: -amount,
          currency: balance.currency,
          description: 'Withdrawal requested',
        },
      });

      return toPayoutResponse(updated);
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failureReason:
            error instanceof Error ? error.message : 'Stripe payout failed',
        },
      });

      throw new ConflictException('Stripe was unable to process this payout');
    }
  }

  async findMine(
    userId: string,
    query: ListPayoutsQueryDto,
  ): Promise<PaginatedPayoutsResponse> {
    const where: Prisma.PayoutWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [payouts, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return {
      data: payouts.map((payout) => toPayoutResponse(payout)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PayoutResponse> {
    const payout = await this.prisma.payout.findUnique({ where: { id } });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.userId !== user.id && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException('You cannot view this payout');
    }

    return toPayoutResponse(payout);
  }

  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  private mapStripeStatus(status: string): PayoutStatus {
    switch (status) {
      case 'paid':
        return PayoutStatus.PAID;
      case 'in_transit':
        return PayoutStatus.IN_TRANSIT;
      case 'failed':
        return PayoutStatus.FAILED;
      case 'canceled':
        return PayoutStatus.CANCELED;
      default:
        return PayoutStatus.PENDING;
    }
  }
}
