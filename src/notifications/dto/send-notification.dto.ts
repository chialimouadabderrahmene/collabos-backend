import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { IsArray, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Key of an active NotificationTemplate' })
  templateKey!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    isArray: true,
    description: 'Defaults to all channels, filtered by user preferences',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];
}
