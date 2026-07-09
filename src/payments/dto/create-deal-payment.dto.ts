import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateDealPaymentDto {
  @ApiProperty({ description: 'Deal to fund' })
  @IsUUID('4')
  dealId!: string;
}
