import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityAssetKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UploadAssetDto {
  @ApiProperty({ enum: OpportunityAssetKind })
  @IsEnum(OpportunityAssetKind)
  kind!: OpportunityAssetKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;
}

export class UpdateAssetDto {
  @ApiProperty({ description: 'Empty string clears the alt text' })
  @IsString()
  @MaxLength(500)
  altText!: string;
}

export class PublishOpportunityDto {
  @ApiPropertyOptional({ description: 'Release notes for this version' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'If set, publishing fails with 409 unless the draft is still at this revision (publish exactly what was reviewed).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedDraftRevision?: number;
}

export class CreateShareLinkDto {
  @ApiProperty({ minimum: 1, description: 'Published version to pin' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber!: number;

  @ApiPropertyOptional({
    description: 'ISO date-time; must be in the future, at most 365 days out',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'Atelier Rossi — first look' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
