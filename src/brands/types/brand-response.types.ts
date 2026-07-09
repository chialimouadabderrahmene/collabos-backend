import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class BrandProfileResponse {
  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  websiteUrl!: string | null;

  @ApiProperty({ nullable: true })
  instagramHandle!: string | null;

  @ApiProperty({ nullable: true })
  contactEmail!: string | null;

  @ApiProperty({ nullable: true })
  foundedYear!: number | null;

  @ApiProperty({ nullable: true })
  location!: string | null;
}

export class BrandResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true })
  coverUrl!: string | null;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ nullable: true })
  verifiedAt!: Date | null;

  @ApiProperty()
  followersCount!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [CategoryResponse] })
  categories!: CategoryResponse[];

  @ApiProperty({ type: BrandProfileResponse, nullable: true })
  profile!: BrandProfileResponse | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedBrandsResponse {
  @ApiProperty({ type: [BrandResponse] })
  data!: BrandResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class FollowerResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  displayName!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

export class PaginatedFollowersResponse {
  @ApiProperty({ type: [FollowerResponse] })
  data!: FollowerResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class LogoResponse {
  @ApiProperty({ nullable: true })
  logoUrl!: string | null;
}

export class CoverResponse {
  @ApiProperty({ nullable: true })
  coverUrl!: string | null;
}

export class FollowResponse {
  @ApiProperty()
  following!: boolean;

  @ApiProperty()
  followersCount!: number;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
