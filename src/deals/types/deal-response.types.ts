import { ApiProperty } from '@nestjs/swagger';
import { DealParty, DealStatus, ProposalStatus } from '@prisma/client';

export const DEAL_HEALTH_VALUES = [
  'ON_TRACK',
  'AT_RISK',
  'OVERDUE',
  'COMPLETED',
  'CANCELLED',
] as const;

export type DealHealth = (typeof DEAL_HEALTH_VALUES)[number];

export class DealResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  applicationId!: string;

  @ApiProperty()
  briefId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: DealStatus })
  status!: DealStatus;

  @ApiProperty({ enum: DEAL_HEALTH_VALUES })
  health!: DealHealth;

  @ApiProperty({ nullable: true })
  totalValue!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  revenueSplitBrand!: number | null;

  @ApiProperty({ nullable: true })
  revenueSplitCreator!: number | null;

  @ApiProperty({ nullable: true })
  startDate!: Date | null;

  @ApiProperty({ nullable: true })
  endDate!: Date | null;

  @ApiProperty({ nullable: true })
  activatedAt!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedDealsResponse {
  @ApiProperty({ type: [DealResponse] })
  data!: DealResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class ProposalResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dealId!: string;

  @ApiProperty()
  proposedById!: string;

  @ApiProperty({ enum: ProposalStatus })
  status!: ProposalStatus;

  @ApiProperty({ nullable: true })
  totalValue!: number | null;

  @ApiProperty({ nullable: true })
  revenueSplitBrand!: number | null;

  @ApiProperty({ nullable: true })
  revenueSplitCreator!: number | null;

  @ApiProperty({ nullable: true })
  startDate!: Date | null;

  @ApiProperty({ nullable: true })
  endDate!: Date | null;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  respondedAt!: Date | null;
}

export class ResponsibilityResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DealParty })
  party!: DealParty;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  dueDate!: Date | null;

  @ApiProperty()
  isCompleted!: boolean;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;
}

export class MilestoneResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  dueDate!: Date | null;

  @ApiProperty()
  position!: number;

  @ApiProperty()
  isCompleted!: boolean;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;
}

export class DealHealthResponse {
  @ApiProperty()
  dealId!: string;

  @ApiProperty({ enum: DEAL_HEALTH_VALUES })
  health!: DealHealth;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
