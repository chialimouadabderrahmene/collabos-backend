import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ description: 'Amount to refund, in whole currency units' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount!: number;

  @ApiProperty({ example: 'Item arrived damaged' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
