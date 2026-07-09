import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectRefundDto {
  @ApiProperty({ example: 'Item does not meet return policy' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
