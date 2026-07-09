import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newSignupsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  announcementBanner?: string;
}
