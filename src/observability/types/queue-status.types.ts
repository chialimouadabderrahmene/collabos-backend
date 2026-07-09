import { ApiProperty } from '@nestjs/swagger';

export class QueueStatusResponse {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  waiting!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  delayed!: number;
}

export class QueuesStatusResponse {
  @ApiProperty({ type: [QueueStatusResponse] })
  queues!: QueueStatusResponse[];
}
