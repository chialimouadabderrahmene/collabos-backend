import { ApiProperty } from '@nestjs/swagger';
import { BriefStatus } from '@prisma/client';

export class BriefResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  budgetMin!: number | null;

  @ApiProperty({ nullable: true })
  budgetMax!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [String] })
  deliverables!: string[];

  @ApiProperty({ nullable: true })
  applicationDeadline!: Date | null;

  @ApiProperty({ nullable: true })
  location!: string | null;

  @ApiProperty()
  isRemote!: boolean;

  @ApiProperty({ enum: BriefStatus })
  status!: BriefStatus;

  @ApiProperty({ nullable: true })
  closedAt!: Date | null;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedBriefsResponse {
  @ApiProperty({ type: [BriefResponse] })
  data!: BriefResponse[];

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
