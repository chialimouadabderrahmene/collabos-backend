import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProfileVisibility } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ enum: ProfileVisibility })
  @IsOptional()
  @IsEnum(ProfileVisibility)
  profileVisibility?: ProfileVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowSearchIndexing?: boolean;
}
