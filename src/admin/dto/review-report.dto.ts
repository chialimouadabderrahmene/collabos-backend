import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationAction, ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @ApiPropertyOptional({ enum: ModerationAction })
  @IsOptional()
  @IsEnum(ModerationAction)
  actionTaken?: ModerationAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
