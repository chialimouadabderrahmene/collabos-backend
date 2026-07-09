import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DealParty } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateResponsibilityDto {
  @ApiProperty({ enum: DealParty })
  @IsEnum(DealParty)
  party!: DealParty;

  @ApiProperty({ example: 'Deliver 10 edited photos by launch day' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
