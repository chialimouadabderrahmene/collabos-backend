import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectAccountStatus } from '@prisma/client';
import type Stripe from 'stripe';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { toConnectAccountResponse } from '../mappers/payment.mapper';
import {
  ConnectAccountResponse,
  ConnectOnboardingResponse,
} from '../types/payment-response.types';
import { StripeService } from './stripe.service';

@Injectable()
export class ConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async onboard(user: AuthenticatedUser): Promise<ConnectOnboardingResponse> {
    let account = await this.prisma.connectedAccount.findUnique({
      where: { userId: user.id },
    });

    if (!account) {
      const stripeAccount = await this.stripeService.createConnectedAccount(
        user.email,
      );

      account = await this.prisma.connectedAccount.create({
        data: {
          userId: user.id,
          stripeAccountId: stripeAccount.id,
        },
      });
    } else if (account.status === ConnectAccountStatus.ACTIVE) {
      throw new ConflictException('This account is already fully onboarded');
    }

    const accountLink = await this.stripeService.createAccountLink(
      account.stripeAccountId,
    );

    return { url: accountLink.url };
  }

  async getStatus(user: AuthenticatedUser): Promise<ConnectAccountResponse> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId: user.id },
    });

    if (!account) {
      throw new NotFoundException('No connected account found for this user');
    }

    return toConnectAccountResponse(account);
  }

  async syncFromStripeAccount(stripeAccount: Stripe.Account): Promise<void> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { stripeAccountId: stripeAccount.id },
    });

    if (!account) {
      return;
    }

    const status = this.resolveStatus(stripeAccount);

    await this.prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status,
        chargesEnabled: !!stripeAccount.charges_enabled,
        payoutsEnabled: !!stripeAccount.payouts_enabled,
        detailsSubmitted: !!stripeAccount.details_submitted,
      },
    });
  }

  async getRecipientAccountOrThrow(userId: string): Promise<string> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId },
    });

    if (!account || !account.payoutsEnabled) {
      throw new ConflictException(
        'The recipient has not completed payout onboarding',
      );
    }

    return account.stripeAccountId;
  }

  private resolveStatus(stripeAccount: Stripe.Account): ConnectAccountStatus {
    if (stripeAccount.requirements?.disabled_reason) {
      return ConnectAccountStatus.RESTRICTED;
    }

    if (stripeAccount.charges_enabled && stripeAccount.payouts_enabled) {
      return ConnectAccountStatus.ACTIVE;
    }

    return ConnectAccountStatus.PENDING;
  }
}
