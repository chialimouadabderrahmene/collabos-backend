import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelDealDto {
  @ApiPropertyOptional({ example: 'Creator became unavailable' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
