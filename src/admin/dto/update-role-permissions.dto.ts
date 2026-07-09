import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['users:manage', 'audit:view'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
