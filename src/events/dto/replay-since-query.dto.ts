import { ApiPropertyOptional } from '@nestjs/swagger';
import { OutboxEventStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class ReplaySinceQueryDto {
  @ApiPropertyOptional({
    description: 'ISO date; replays events created at or after this time',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({ enum: OutboxEventStatus })
  @IsOptional()
  @IsEnum(OutboxEventStatus)
  status?: OutboxEventStatus;
}
