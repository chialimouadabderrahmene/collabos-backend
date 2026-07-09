import { ApiProperty } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateShipmentStatusDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;
}
