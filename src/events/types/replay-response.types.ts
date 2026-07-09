import { ApiProperty } from '@nestjs/swagger';

export class ReplayResultResponse {
  @ApiProperty()
  republished!: boolean;
}

export class ReplaySummaryResponse {
  @ApiProperty()
  attempted!: number;

  @ApiProperty()
  republished!: number;

  @ApiProperty()
  skipped!: number;
}
