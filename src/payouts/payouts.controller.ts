import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { PayoutsService } from './services/payouts.service';
import { WebhookService } from './services/webhook.service';
import {
  PaginatedPayoutsResponse,
  PayoutResponse,
} from './types/payout-response.types';

@ApiTags('payouts')
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('withdraw')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Withdraw available balance to my connected bank account',
  })
  @ApiResponse({ status: 201, type: PayoutResponse })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ): Promise<PayoutResponse> {
    return this.payoutsService.withdraw(user, dto);
  }

  @Public()
  @Post('webhook/stripe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook endpoint for payout events' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    return this.webhookService.handle(req.rawBody as Buffer, signature);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my withdrawal history' })
  @ApiResponse({ status: 200, type: PaginatedPayoutsResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayoutsQueryDto,
  ): Promise<PaginatedPayoutsResponse> {
    return this.payoutsService.findMine(user.id, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payout' })
  @ApiResponse({ status: 200, type: PayoutResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayoutResponse> {
    return this.payoutsService.findOneOrThrow(id, user);
  }
}
