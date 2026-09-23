import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityAiSuggestionStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class GenerateCopyDto {
  @ApiProperty({
    description: 'Founder brief: the idea, product, audience, what is sought',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  instructions!: string;

  @ApiPropertyOptional({ example: 'quiet luxury, editorial, confident' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;
}

export class RewriteCopyDto {
  @ApiProperty({ description: 'Text selected in the editor' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  text!: string;

  @ApiPropertyOptional({ example: 'Make it more concise and evocative' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instruction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;
}

export class StructureDto {
  @ApiProperty({
    description:
      'Raw founder input (notes, bullet points, pasted references) to turn into an editorial structure',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  notes!: string;
}

export class ListAiSuggestionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OpportunityAiSuggestionStatus })
  @IsOptional()
  @IsEnum(OpportunityAiSuggestionStatus)
  status?: OpportunityAiSuggestionStatus;
}
