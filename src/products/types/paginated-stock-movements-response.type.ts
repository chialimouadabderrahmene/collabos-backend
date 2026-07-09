import { ApiProperty } from '@nestjs/swagger';
import { StockMovementResponse } from './product-response.types';

export class PaginatedStockMovementsResponse {
  @ApiProperty({ type: [StockMovementResponse] })
  data!: StockMovementResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
