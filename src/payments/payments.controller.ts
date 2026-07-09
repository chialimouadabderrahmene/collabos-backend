import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { CreateDealPaymentDto } from './dto/create-deal-payment.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { PaymentsService } from './services/payments.service';
import { WebhookService } from './services/webhook.service';
import { PaymentResponse } from './types/payment-response.types';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('orders')
  @ApiBearerAuth()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Client-supplied key; replays return the original response',
  })
  @ApiOperation({ summary: 'Create a payment for an order (buyer only)' })
  @ApiResponse({ status: 201, type: PaymentResponse })
  createForOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.createForOrder(dto.orderId, user);
  }

  @Post('deals')
  @ApiBearerAuth()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Client-supplied key; replays return the original response',
  })
  @ApiOperation({
    summary: 'Create a payment to fund a deal (brand owner only)',
  })
  @ApiResponse({ status: 201, type: PaymentResponse })
  createForDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDealPaymentDto,
  ): Promise<PaymentResponse> {
    return this.paymentsService.createForDeal(dto.dealId, user);
  }

  @Public()
  @Post('webhook/stripe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    return this.webhookService.handle(req.rawBody as Buffer, signature);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my payments (as payer or recipient)' })
  @ApiResponse({ status: 200, type: [PaymentResponse] })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<PaymentResponse[]> {
    return this.paymentsService.findMine(user);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment' })
  @ApiResponse({ status: 200, type: PaymentResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    return this.paymentsService.findOneOrThrow(id, user);
  }

  @Post(':id/release')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Release escrowed funds to recipients (admin only)',
  })
  @ApiResponse({ status: 200, type: PaymentResponse })
  release(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    return this.paymentsService.release(id, user);
  }

  @Post(':id/refund')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment before its funds are released' })
  @ApiResponse({ status: 200, type: PaymentResponse })
  refund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResponse> {
    return this.paymentsService.refund(id, user);
  }
}
