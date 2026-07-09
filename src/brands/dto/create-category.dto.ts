import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Streetwear' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;
}
