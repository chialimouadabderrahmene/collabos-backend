import { ApiProperty } from '@nestjs/swagger';

export class SearchHitResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: Object })
  document!: Record<string, unknown>;
}

export class SearchResultsResponse {
  @ApiProperty()
  found!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty({ type: [SearchHitResponse] })
  hits!: SearchHitResponse[];
}
