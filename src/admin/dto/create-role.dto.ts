import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'BRAND_MODERATOR' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'name must be upper-snake-case, e.g. BRAND_MODERATOR',
  })
  name!: string;
}
