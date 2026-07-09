import { Module } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { PayoutsController } from './payouts.controller';
import { ReportsController } from './reports.controller';
import { BalanceService } from './services/balance.service';
import { PayoutsService } from './services/payouts.service';
import { ReportsService } from './services/reports.service';
import { StripeService } from './services/stripe.service';
import { TransfersService } from './services/transfers.service';
import { WebhookService } from './services/webhook.service';
import { TransfersController } from './transfers.controller';

@Module({
  controllers: [
    BalanceController,
    TransfersController,
    ReportsController,
    PayoutsController,
  ],
  providers: [
    StripeService,
    BalanceService,
    TransfersService,
    ReportsService,
    PayoutsService,
    WebhookService,
  ],
  exports: [BalanceService],
})
export class PayoutsModule {}
