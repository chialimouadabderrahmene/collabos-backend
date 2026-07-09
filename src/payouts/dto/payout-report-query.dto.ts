import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class PayoutReportQueryDto {
  @ApiPropertyOptional({ description: 'ISO date, inclusive start of period' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive end of period' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
