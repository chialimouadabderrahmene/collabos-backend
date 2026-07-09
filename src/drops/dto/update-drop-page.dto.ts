import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDropPageDto {
  @ApiPropertyOptional({ example: 'The SS27 Capsule Collection is here' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  subheadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Long-form page copy (markdown or plain text)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyContent?: string;

  @ApiPropertyOptional({ example: 'Shop the drop' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string;
}
