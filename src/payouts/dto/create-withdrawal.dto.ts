import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiPropertyOptional({
    description: 'Amount to withdraw. Defaults to the full available balance.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;
}
