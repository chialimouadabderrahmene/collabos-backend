import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ description: 'Activate or deactivate the account' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
