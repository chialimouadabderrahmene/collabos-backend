import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class ApplicationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  briefId!: string;

  @ApiProperty()
  applicantId!: string;

  @ApiProperty({ enum: ApplicationStatus })
  status!: ApplicationStatus;

  @ApiProperty()
  coverMessage!: string;

  @ApiProperty({ nullable: true })
  proposedBudget!: number | null;

  @ApiProperty({ nullable: true })
  decidedAt!: Date | null;

  @ApiProperty({ nullable: true })
  withdrawnAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedApplicationsResponse {
  @ApiProperty({ type: [ApplicationResponse] })
  data!: ApplicationResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
