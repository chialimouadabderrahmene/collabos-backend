import { ApiProperty } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

export class CategoryResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class ProductMediaResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ nullable: true })
  altText!: string | null;

  @ApiProperty()
  position!: number;
}

export class VariantResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ nullable: true })
  size!: string | null;

  @ApiProperty({ nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  priceOverride!: number | null;

  @ApiProperty()
  effectivePrice!: number;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class ProductResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty({ nullable: true })
  compareAtPrice!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [CategoryResponse] })
  categories!: CategoryResponse[];

  @ApiProperty({ description: 'Total stock across all variants' })
  totalStock!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedProductsResponse {
  @ApiProperty({ type: [ProductResponse] })
  data!: ProductResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class StockMovementResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: StockMovementType })
  type!: StockMovementType;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ nullable: true })
  reason!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
