import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ConnectController } from './connect.controller';
import { PaymentSucceededHandler } from './events/payment-succeeded.handler';
import { InvoicesController } from './invoices.controller';
import { PaymentsController } from './payments.controller';
import { ConnectService } from './services/connect.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoicesService } from './services/invoices.service';
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';
import { TransactionsService } from './services/transactions.service';
import { WebhookService } from './services/webhook.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [EventsModule],
  // Order matters: PaymentsController declares GET payments/:id, which would
  // swallow the literal one-segment routes payments/invoices and
  // payments/transactions if it were registered before them.
  controllers: [
    ConnectController,
    InvoicesController,
    TransactionsController,
    PaymentsController,
  ],
  providers: [
    StripeService,
    ConnectService,
    PaymentsService,
    TransactionsService,
    InvoicePdfService,
    InvoicesService,
    WebhookService,
    PaymentSucceededHandler,
  ],
  exports: [PaymentsService, TransactionsService],
})
export class PaymentsModule {}
