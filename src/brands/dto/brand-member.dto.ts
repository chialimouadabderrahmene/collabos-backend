import { ApiProperty } from '@nestjs/swagger';
import { BrandMemberRole } from '@prisma/client';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';

export class AddBrandMemberDto {
  @ApiProperty({ description: 'Email of an existing CollabOS user' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: BrandMemberRole })
  @IsEnum(BrandMemberRole)
  role!: BrandMemberRole;
}

export class UpdateBrandMemberDto {
  @ApiProperty({ enum: BrandMemberRole })
  @IsEnum(BrandMemberRole)
  role!: BrandMemberRole;
}
