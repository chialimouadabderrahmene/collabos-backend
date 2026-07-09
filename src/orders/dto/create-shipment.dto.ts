import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty({ example: 'UPS' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  carrier!: string;

  @ApiProperty({ example: '1Z999AA10123456784' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  trackingNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
