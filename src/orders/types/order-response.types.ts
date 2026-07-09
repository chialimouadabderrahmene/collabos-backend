import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, RefundStatus, ShipmentStatus } from '@prisma/client';

export class CartItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  variantId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  lineTotal!: number;
}

export class CartResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: [CartItemResponse] })
  items!: CartItemResponse[];

  @ApiProperty()
  total!: number;
}

export class OrderItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  variantId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  quantity!: number;
}

export class OrderResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  buyerId!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [OrderItemResponse] })
  items!: OrderItemResponse[];

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedOrdersResponse {
  @ApiProperty({ type: [OrderResponse] })
  data!: OrderResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class RefundResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: RefundStatus })
  status!: RefundStatus;

  @ApiProperty({ nullable: true })
  rejectedReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  processedAt!: Date | null;
}

export class ShipmentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  carrier!: string;

  @ApiProperty()
  trackingNumber!: string;

  @ApiProperty({ nullable: true })
  trackingUrl!: string | null;

  @ApiProperty({ enum: ShipmentStatus })
  status!: ShipmentStatus;

  @ApiProperty({ nullable: true })
  shippedAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveredAt!: Date | null;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
