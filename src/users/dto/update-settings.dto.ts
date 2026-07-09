import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ThemePreference })
  @IsOptional()
  @IsEnum(ThemePreference)
  theme?: ThemePreference;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ example: 'Europe/Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
