import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidContractDto {
  @ApiPropertyOptional({ example: 'Terms could not be agreed upon' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
