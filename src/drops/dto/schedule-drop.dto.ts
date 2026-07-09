import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ScheduleDropDto {
  @ApiProperty({ description: 'ISO date/time to auto-publish the drop' })
  @IsDateString()
  publishAt!: string;
}
