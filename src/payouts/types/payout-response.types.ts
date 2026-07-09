import { ApiProperty } from '@nestjs/swagger';
import { PayoutStatus } from '@prisma/client';

export class BalanceResponse {
  @ApiProperty()
  available!: number;

  @ApiProperty()
  pendingWithdrawals!: number;

  @ApiProperty()
  totalWithdrawn!: number;

  @ApiProperty()
  totalEarned!: number;

  @ApiProperty()
  currency!: string;
}

export class PayoutResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PayoutStatus })
  status!: PayoutStatus;

  @ApiProperty({ nullable: true })
  failureReason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedPayoutsResponse {
  @ApiProperty({ type: [PayoutResponse] })
  data!: PayoutResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class TransferResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ nullable: true })
  stripeTransferId!: string | null;

  @ApiProperty({ nullable: true })
  releasedAt!: Date | null;
}

export class PaginatedTransfersResponse {
  @ApiProperty({ type: [TransferResponse] })
  data!: TransferResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class PayoutReportResponse {
  @ApiProperty()
  periodFrom!: Date | null;

  @ApiProperty()
  periodTo!: Date | null;

  @ApiProperty()
  totalEarned!: number;

  @ApiProperty()
  totalWithdrawn!: number;

  @ApiProperty()
  payoutCount!: number;

  @ApiProperty()
  currency!: string;
}
