import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Sounds great, let’s do it!' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
