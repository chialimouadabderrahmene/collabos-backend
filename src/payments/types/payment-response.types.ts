import { ApiProperty } from '@nestjs/swagger';
import {
  ConnectAccountStatus,
  InvoiceStatus,
  PaymentStatus,
  SplitStatus,
  TransactionType,
} from '@prisma/client';

export class ConnectAccountResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ConnectAccountStatus })
  status!: ConnectAccountStatus;

  @ApiProperty()
  chargesEnabled!: boolean;

  @ApiProperty()
  payoutsEnabled!: boolean;

  @ApiProperty()
  detailsSubmitted!: boolean;
}

export class ConnectOnboardingResponse {
  @ApiProperty()
  url!: string;
}

export class PaymentSplitResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  recipientUserId!: string | null;

  @ApiProperty()
  isPlatformFee!: boolean;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ enum: SplitStatus })
  status!: SplitStatus;

  @ApiProperty({ nullable: true })
  releasedAt!: Date | null;
}

export class PaymentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  payerId!: string;

  @ApiProperty({ nullable: true })
  orderId!: string | null;

  @ApiProperty({ nullable: true })
  dealId!: string | null;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true })
  clientSecret!: string | null;

  @ApiProperty({ type: [PaymentSplitResponse] })
  splits!: PaymentSplitResponse[];

  @ApiProperty()
  createdAt!: Date;
}

export class InvoiceResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  issuedToId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  pdfAvailable!: boolean;

  @ApiProperty()
  issuedAt!: Date;
}

export class TransactionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  paymentId!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedTransactionsResponse {
  @ApiProperty({ type: [TransactionResponse] })
  data!: TransactionResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
