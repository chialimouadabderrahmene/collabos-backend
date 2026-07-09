import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({
    description: 'Shipping address, stored as-is with the order',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;
}
