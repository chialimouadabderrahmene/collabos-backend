import { ApiProperty } from '@nestjs/swagger';
import { OutboxEventStatus } from '@prisma/client';

export class OutboxEventResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  aggregateType!: string;

  @ApiProperty()
  aggregateId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ enum: OutboxEventStatus })
  status!: OutboxEventStatus;

  @ApiProperty()
  attempts!: number;

  @ApiProperty({ nullable: true })
  lastError!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  publishedAt!: Date | null;
}

export class PaginatedOutboxEventsResponse {
  @ApiProperty({ type: [OutboxEventResponse] })
  data!: OutboxEventResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
