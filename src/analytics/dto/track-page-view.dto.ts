import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageViewTargetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class TrackPageViewDto {
  @ApiProperty()
  @IsUUID()
  brandId!: string;

  @ApiProperty({ enum: PageViewTargetType })
  @IsEnum(PageViewTargetType)
  targetType!: PageViewTargetType;

  @ApiProperty()
  @IsString()
  targetId!: string;

  @ApiProperty({ description: 'Anonymous client-generated visitor id' })
  @IsString()
  visitorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrer?: string;
}
