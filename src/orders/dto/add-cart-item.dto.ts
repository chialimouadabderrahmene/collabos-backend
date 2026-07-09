import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product variant to add' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}
