import { ApiProperty } from '@nestjs/swagger';
import { BrandMemberRole } from '@prisma/client';

export class BrandMemberResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ enum: BrandMemberRole })
  role!: BrandMemberRole;

  @ApiProperty({ description: 'True for the brand legal owner' })
  isBrandOwner!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
