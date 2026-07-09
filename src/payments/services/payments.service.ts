import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Payment,
  PaymentSplit,
  PaymentStatus,
  Prisma,
  SplitStatus,
  TransactionType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { toPaymentResponse } from '../mappers/payment.mapper';
import { PaymentResponse } from '../types/payment-response.types';
import { ConnectService } from './connect.service';
import { StripeService } from './stripe.service';
import { TransactionsService } from './transactions.service';

const PAYMENT_INCLUDE = { splits: true } as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly connectService: ConnectService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async createForOrder(
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== user.id) {
      throw new ForbiddenException('Only the buyer can pay for this order');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('This order is not awaiting payment');
    }

    if (order.payment) {
      throw new ConflictException('A payment already exists for this order');
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: order.brandId },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return this.createPayment({
      payerId: user.id,
      amount: order.subtotal,
      currency: order.currency,
      orderId: order.id,
      recipientUserId: brand.ownerId,
      metadata: { orderId: order.id },
    });
  }

  async createForDeal(
    dealId: string,
    user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { payment: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    if (deal.status !== 'ACTIVE') {
      throw new ConflictException('Only active deals can be funded');
    }

    if (deal.payment) {
      throw new ConflictException('A payment already exists for this deal');
    }

    if (!deal.totalValue) {
      throw new BadRequestException('This deal has no agreed total value');
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: deal.brandId },
    });

    if (!brand || brand.ownerId !== user.id) {
      throw new ForbiddenException('Only the brand owner can fund this deal');
    }

    return this.createPayment({
      payerId: user.id,
      amount: deal.totalValue,
      currency: deal.currency,
      dealId: deal.id,
      recipientUserId: deal.creatorId,
      metadata: { dealId: deal.id },
    });
  }

  async findMine(user: AuthenticatedUser): Promise<PaymentResponse[]> {
    const where: Prisma.PaymentWhereInput = {
      OR: [
        { payerId: user.id },
        { splits: { some: { recipientUserId: user.id } } },
      ],
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((payment) => toPaymentResponse(payment));
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    const payment = await this.findEntityOrThrow(id);
    this.assertParticipant(payment, user);

    return toPaymentResponse(payment);
  }

  async release(id: string, user: AuthenticatedUser): Promise<PaymentResponse> {
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Only an administrator can release escrowed funds',
      );
    }

    const payment = await this.findEntityOrThrow(id);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new ConflictException('Only a succeeded payment can be released');
    }

    await this.assertFulfilled(payment);

    for (const split of payment.splits) {
      if (split.status !== SplitStatus.PENDING) {
        continue;
      }

      if (split.isPlatformFee) {
        await this.prisma.paymentSplit.update({
          where: { id: split.id },
          data: { status: SplitStatus.RELEASED, releasedAt: new Date() },
        });
        continue;
      }

      if (!split.recipientUserId) {
        continue;
      }

      const destinationAccountId =
        await this.connectService.getRecipientAccountOrThrow(
          split.recipientUserId,
        );

      const transfer = await this.stripeService.createTransfer({
        amount: this.toMinorUnits(split.amount),
        currency: payment.currency,
        destinationAccountId,
        metadata: { paymentId: payment.id, splitId: split.id },
      });

      await this.prisma.paymentSplit.update({
        where: { id: split.id },
        data: {
          status: SplitStatus.RELEASED,
          stripeTransferId: transfer.id,
          releasedAt: new Date(),
        },
      });

      await this.transactionsService.record({
        userId: split.recipientUserId,
        type: TransactionType.TRANSFER,
        amount: split.amount,
        currency: payment.currency,
        paymentId: payment.id,
        description: 'Escrow release',
      });
    }

    const updated = await this.findEntityOrThrow(id);
    return toPaymentResponse(updated);
  }

  async refund(id: string, user: AuthenticatedUser): Promise<PaymentResponse> {
    const payment = await this.findEntityOrThrow(id);

    if (payment.payerId !== user.id && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new ConflictException('Only a succeeded payment can be refunded');
    }

    const hasReleasedSplits = payment.splits.some(
      (split) => split.status === SplitStatus.RELEASED,
    );
    if (hasReleasedSplits) {
      throw new ConflictException(
        'This payment has already released funds and cannot be refunded automatically',
      );
    }

    await this.stripeService.createRefund(payment.stripePaymentIntentId);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: PaymentStatus.REFUNDED },
      }),
      this.prisma.paymentSplit.updateMany({
        where: { paymentId: id },
        data: { status: SplitStatus.REFUNDED },
      }),
    ]);

    await this.transactionsService.record({
      userId: payment.payerId,
      type: TransactionType.REFUND,
      amount: payment.amount,
      currency: payment.currency,
      paymentId: payment.id,
      description: 'Payment refunded',
    });

    const updated = await this.findEntityOrThrow(id);
    return toPaymentResponse(updated);
  }

  async findEntityOrThrow(
    id: string,
  ): Promise<Payment & { splits: PaymentSplit[] }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<(Payment & { splits: PaymentSplit[] }) | null> {
    return this.prisma.payment.findUnique({
      where: { stripePaymentIntentId },
      include: PAYMENT_INCLUDE,
    });
  }

  assertParticipant(
    payment: Payment & { splits: PaymentSplit[] },
    user: AuthenticatedUser,
  ): void {
    if (user.roles.includes('ADMIN') || payment.payerId === user.id) {
      return;
    }

    const isRecipient = payment.splits.some(
      (split) => split.recipientUserId === user.id,
    );

    if (!isRecipient) {
      throw new ForbiddenException('You do not have access to this payment');
    }
  }

  private async createPayment(params: {
    payerId: string;
    amount: number;
    currency: string;
    orderId?: string;
    dealId?: string;
    recipientUserId: string;
    metadata: Record<string, string>;
  }): Promise<PaymentResponse> {
    const feePercent = this.configService.get<number>(
      'stripe.platformFeePercent',
    ) as number;
    const platformFeeAmount = Math.round((params.amount * feePercent) / 100);
    const recipientAmount = params.amount - platformFeeAmount;

    const intent = await this.stripeService.createPaymentIntent({
      amount: this.toMinorUnits(params.amount),
      currency: params.currency,
      metadata: { ...params.metadata, payerId: params.payerId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        stripePaymentIntentId: intent.id,
        payerId: params.payerId,
        orderId: params.orderId,
        dealId: params.dealId,
        amount: params.amount,
        currency: params.currency,
        clientSecret: intent.client_secret,
        splits: {
          create: [
            { isPlatformFee: true, amount: platformFeeAmount },
            {
              recipientUserId: params.recipientUserId,
              amount: recipientAmount,
            },
          ],
        },
      },
      include: PAYMENT_INCLUDE,
    });

    return toPaymentResponse(payment);
  }

  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  private async assertFulfilled(
    payment: Payment & { splits: PaymentSplit[] },
  ): Promise<void> {
    if (payment.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: payment.orderId },
      });

      if (!order || !['FULFILLED', 'COMPLETED'].includes(order.status)) {
        throw new ConflictException(
          'The linked order has not been fulfilled yet',
        );
      }
      return;
    }

    if (payment.dealId) {
      const deal = await this.prisma.deal.findUnique({
        where: { id: payment.dealId },
      });

      if (!deal || deal.status !== 'COMPLETED') {
        throw new ConflictException(
          'The linked deal has not been completed yet',
        );
      }
    }
  }
}
