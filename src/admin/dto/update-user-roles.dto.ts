import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({ type: [String], example: ['USER', 'ADMIN'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roles!: string[];
}
