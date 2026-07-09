import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class AssignCategoriesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  categoryIds!: string[];
}
