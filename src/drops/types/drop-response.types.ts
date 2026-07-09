import { ApiProperty } from '@nestjs/swagger';
import { DropMediaType, DropStatus, DropVisibility } from '@prisma/client';

export class DropResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty({ nullable: true })
  dealId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: DropStatus })
  status!: DropStatus;

  @ApiProperty({ enum: DropVisibility })
  visibility!: DropVisibility;

  @ApiProperty({ nullable: true })
  publishAt!: Date | null;

  @ApiProperty({ nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedDropsResponse {
  @ApiProperty({ type: [DropResponse] })
  data!: DropResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class DropPageResponse {
  @ApiProperty({ nullable: true })
  headline!: string | null;

  @ApiProperty({ nullable: true })
  subheadline!: string | null;

  @ApiProperty({ nullable: true })
  heroImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  bodyContent!: string | null;

  @ApiProperty({ nullable: true })
  ctaLabel!: string | null;

  @ApiProperty({ nullable: true })
  ctaUrl!: string | null;
}

export class DropSeoResponse {
  @ApiProperty({ nullable: true })
  metaTitle!: string | null;

  @ApiProperty({ nullable: true })
  metaDescription!: string | null;

  @ApiProperty({ nullable: true })
  ogImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  canonicalUrl!: string | null;

  @ApiProperty({ type: [String] })
  keywords!: string[];
}

export class DropMediaResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ enum: DropMediaType })
  type!: DropMediaType;

  @ApiProperty({ nullable: true })
  altText!: string | null;

  @ApiProperty()
  position!: number;
}

export class DropProductResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  sku!: string | null;

  @ApiProperty({ nullable: true })
  stockQuantity!: number | null;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  position!: number;

  @ApiProperty()
  isAvailable!: boolean;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
