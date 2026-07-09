import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
