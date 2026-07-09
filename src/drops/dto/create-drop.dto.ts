import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDropDto {
  @ApiProperty({ description: 'Brand running this drop' })
  @IsUUID('4')
  brandId!: string;

  @ApiPropertyOptional({
    description: 'Deal this drop originated from, if any',
  })
  @IsOptional()
  @IsUUID('4')
  dealId?: string;

  @ApiProperty({ example: 'SS27 Capsule Collection' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
