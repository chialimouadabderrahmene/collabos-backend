import { ApiProperty } from '@nestjs/swagger';
import { BrandMemberRole } from '@prisma/client';
import { BrandResponse } from './brand-response.types';

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

/** A brand the current user belongs to, with their effective role. */
export class MyBrandResponse extends BrandResponse {
  @ApiProperty({ enum: BrandMemberRole })
  role!: BrandMemberRole;
}
