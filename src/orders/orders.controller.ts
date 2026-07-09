import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { RejectRefundDto } from './dto/reject-refund.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { CheckoutService } from './services/checkout.service';
import { OrdersService } from './services/orders.service';
import { RefundsService } from './services/refunds.service';
import { ShipmentsService } from './services/shipments.service';
import { WebhookService } from './services/webhook.service';
import {
  OrderResponse,
  PaginatedOrdersResponse,
  RefundResponse,
  ShipmentResponse,
} from './types/order-response.types';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly ordersService: OrdersService,
    private readonly refundsService: RefundsService,
    private readonly shipmentsService: ShipmentsService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check out my cart (creates one order per brand)' })
  @ApiResponse({ status: 201, type: [OrderResponse] })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ): Promise<OrderResponse[]> {
    return this.checkoutService.checkout(user.id, dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Payment provider webhook (HMAC-signed)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() payload: WebhookPayloadDto,
  ): Promise<{ received: true }> {
    this.webhookService.verifySignature(req.rawBody as Buffer, signature);
    return this.webhookService.handleEvent(payload);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders (as buyer or brand owner)' })
  @ApiResponse({ status: 200, type: PaginatedOrdersResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedOrdersResponse> {
    return this.ordersService.findMine(user, query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an order' })
  @ApiResponse({ status: 200, type: OrderResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponse> {
    return this.ordersService.findOneOrThrow(id, user);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({ status: 200, type: OrderResponse })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponse> {
    return this.ordersService.cancel(id, user, dto);
  }

  @Post(':id/refunds')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a refund (buyer only)' })
  @ApiResponse({ status: 201, type: RefundResponse })
  createRefund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto,
  ): Promise<RefundResponse> {
    return this.refundsService.create(id, user, dto);
  }

  @Get(':id/refunds')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List refunds for an order' })
  @ApiResponse({ status: 200, type: [RefundResponse] })
  findRefunds(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RefundResponse[]> {
    return this.refundsService.findAll(id, user);
  }

  @Post(':id/refunds/:refundId/approve')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve and process a refund (brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: RefundResponse })
  approveRefund(
    @Param('id') id: string,
    @Param('refundId') refundId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RefundResponse> {
    return this.refundsService.approve(id, refundId, user);
  }

  @Post(':id/refunds/:refundId/reject')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a refund request (brand owner or admin)' })
  @ApiResponse({ status: 200, type: RefundResponse })
  rejectRefund(
    @Param('id') id: string,
    @Param('refundId') refundId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectRefundDto,
  ): Promise<RefundResponse> {
    return this.refundsService.reject(id, refundId, user, dto);
  }

  @Post(':id/shipments')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a shipment for an order (brand owner or admin)',
  })
  @ApiResponse({ status: 201, type: ShipmentResponse })
  createShipment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShipmentDto,
  ): Promise<ShipmentResponse> {
    return this.shipmentsService.create(id, user, dto);
  }

  @Get(':id/shipments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List shipments for an order' })
  @ApiResponse({ status: 200, type: [ShipmentResponse] })
  findShipments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentResponse[]> {
    return this.shipmentsService.findAll(id, user);
  }

  @Patch(':id/shipments/:shipmentId/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a shipment status (brand owner or admin)' })
  @ApiResponse({ status: 200, type: ShipmentResponse })
  updateShipmentStatus(
    @Param('id') id: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponse> {
    return this.shipmentsService.updateStatus(id, shipmentId, user, dto);
  }
}
