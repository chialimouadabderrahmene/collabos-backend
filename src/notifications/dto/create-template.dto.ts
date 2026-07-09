import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pushTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pushBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inAppBody?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
