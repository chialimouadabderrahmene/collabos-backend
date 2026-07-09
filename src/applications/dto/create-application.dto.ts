import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ description: 'Brief being applied to' })
  @IsUUID('4')
  briefId!: string;

  @ApiProperty({ example: "I'd love to shoot your SS27 look-book..." })
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  coverMessage!: string;

  @ApiPropertyOptional({
    description: 'Proposed budget in whole currency units',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  proposedBudget?: number;
}
