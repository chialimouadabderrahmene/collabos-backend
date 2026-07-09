import { ApiPropertyOptional } from '@nestjs/swagger';
import { DigestFrequency, MeasurementUnit } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: DigestFrequency })
  @IsOptional()
  @IsEnum(DigestFrequency)
  digestFrequency?: DigestFrequency;

  @ApiPropertyOptional({ enum: MeasurementUnit })
  @IsOptional()
  @IsEnum(MeasurementUnit)
  measurementUnit?: MeasurementUnit;
}
