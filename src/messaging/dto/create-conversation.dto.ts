import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ type: [String], description: 'Other participant user ids' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  participantIds!: string[];

  @ApiPropertyOptional({
    description: 'Loose reference type, e.g. BRIEF, APPLICATION',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contextType?: string;

  @ApiPropertyOptional({ description: 'Id of the referenced entity' })
  @IsOptional()
  @IsUUID('4')
  contextId?: string;
}
