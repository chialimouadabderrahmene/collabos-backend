import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateOrderPaymentDto {
  @ApiProperty({ description: 'Order to pay for' })
  @IsUUID('4')
  orderId!: string;
}
