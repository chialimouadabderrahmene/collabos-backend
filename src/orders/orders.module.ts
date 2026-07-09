import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { OrdersController } from './orders.controller';
import { CartService } from './services/cart.service';
import { CheckoutService } from './services/checkout.service';
import { OrdersService } from './services/orders.service';
import { RefundsService } from './services/refunds.service';
import { ShipmentsService } from './services/shipments.service';
import { WebhookService } from './services/webhook.service';

@Module({
  controllers: [CartController, OrdersController],
  providers: [
    CartService,
    CheckoutService,
    OrdersService,
    RefundsService,
    ShipmentsService,
    WebhookService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
