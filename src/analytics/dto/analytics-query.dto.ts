import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiProperty()
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive start of period' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive end of period' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
