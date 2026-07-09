import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

export enum AnalyticsGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class AnalyticsSeriesQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: AnalyticsGranularity,
    default: AnalyticsGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity: AnalyticsGranularity = AnalyticsGranularity.DAY;
}
