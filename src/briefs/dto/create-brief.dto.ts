import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBriefDto {
  @ApiProperty({ description: 'Brand this brief is posted under' })
  @IsUUID('4')
  brandId!: string;

  @ApiProperty({ example: 'Look-book photography for SS27 drop' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example: 'We need a photographer for our upcoming collection...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({
    description: 'Minimum budget in whole currency units',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget in whole currency units',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  budgetMax?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['10 edited photos', '3 reels'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  deliverables?: string[];

  @ApiPropertyOptional({
    description: 'ISO date by which applications must be submitted',
  })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @ApiPropertyOptional({ example: 'Paris, France' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;
}
