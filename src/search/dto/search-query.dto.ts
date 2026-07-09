import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  BRANDS_COLLECTION,
  DROPS_COLLECTION,
  PRODUCTS_COLLECTION,
} from '../collections/collection-schemas';

export class SearchQueryDto {
  @ApiProperty({
    enum: [PRODUCTS_COLLECTION, BRANDS_COLLECTION, DROPS_COLLECTION],
  })
  @IsIn([PRODUCTS_COLLECTION, BRANDS_COLLECTION, DROPS_COLLECTION])
  collection!: string;

  @ApiProperty()
  @IsString()
  q!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
