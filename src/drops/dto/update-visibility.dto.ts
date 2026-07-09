import { ApiProperty } from '@nestjs/swagger';
import { DropVisibility } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateVisibilityDto {
  @ApiProperty({ enum: DropVisibility })
  @IsEnum(DropVisibility)
  visibility!: DropVisibility;
}
