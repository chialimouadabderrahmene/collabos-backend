import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityMemberRole, OpportunityStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DOCUMENT_FORMATS,
  type DocumentFormat,
} from '../constants/opportunity.constants';
import { PaginationQueryDto } from './pagination-query.dto';

export class DocumentInputDto {
  @ApiProperty({
    enum: DOCUMENT_FORMATS,
    description: 'Editor that produced `content` (stored as-is)',
  })
  @IsIn(DOCUMENT_FORMATS)
  format!: DocumentFormat;

  @ApiProperty({
    minimum: 1,
    description: 'Editor schema version, for future content migrations',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  schemaVersion!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Editor JSON document. Assets are referenced as "asset:<uuid>" or an `assetId` attribute.',
  })
  @IsObject()
  content!: Record<string, unknown>;
}

export class CreateOpportunityDto {
  @ApiProperty({ description: 'Brand (tenant) that will own the opportunity' })
  @IsUUID('4')
  brandId!: string;

  @ApiProperty({ example: 'AW27 Capsule — Artisan Knitwear Collaboration' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Free-form structured metadata (season, category, tags, ...)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: DocumentInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentInputDto)
  document?: DocumentInputDto;
}

export class UpdateOpportunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ description: 'Empty string clears the summary' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListOpportunitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @ApiPropertyOptional({ enum: OpportunityStatus })
  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @ApiPropertyOptional({ description: 'Title contains (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class SaveDraftDto extends DocumentInputDto {
  @ApiProperty({
    minimum: 0,
    description:
      'Revision the client edited from. A mismatch (someone saved in between) returns 409.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseRevision!: number;
}

export class AddOpportunityMemberDto {
  @ApiProperty({ description: 'Email of an existing CollabOS user' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: OpportunityMemberRole })
  @IsEnum(OpportunityMemberRole)
  role!: OpportunityMemberRole;
}
