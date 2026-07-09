import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateVersionDto {
  @ApiProperty({ description: 'Full contract terms text for the new version' })
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  content!: string;
}
