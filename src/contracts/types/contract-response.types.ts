import { ApiProperty } from '@nestjs/swagger';
import { AgreementStatus, ContractEventType, DealParty } from '@prisma/client';

export class ContractResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dealId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty({ enum: AgreementStatus })
  status!: AgreementStatus;

  @ApiProperty()
  currentVersionNumber!: number;

  @ApiProperty({ nullable: true })
  executedAt!: Date | null;

  @ApiProperty({ nullable: true })
  voidedAt!: Date | null;

  @ApiProperty({ nullable: true })
  voidReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedContractsResponse {
  @ApiProperty({ type: [ContractResponse] })
  data!: ContractResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class SignatureResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DealParty })
  party!: DealParty;

  @ApiProperty()
  signerId!: string;

  @ApiProperty()
  signedName!: string;

  @ApiProperty()
  signedAt!: Date;
}

export class ContractVersionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty()
  content!: string;

  @ApiProperty({ nullable: true })
  pdfAvailable!: boolean;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [SignatureResponse] })
  signatures!: SignatureResponse[];
}

export class ContractEventResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ContractEventType })
  type!: ContractEventType;

  @ApiProperty({ nullable: true })
  actorId!: string | null;

  @ApiProperty({ nullable: true, type: Object })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
