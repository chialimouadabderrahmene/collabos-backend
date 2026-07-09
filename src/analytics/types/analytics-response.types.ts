import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PageViewTargetType } from '@prisma/client';

export class RevenueSummaryResponse {
  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  orderCount!: number;

  @ApiProperty()
  averageOrderValue!: number;

  @ApiProperty()
  currency!: string;
}

export class RevenueSeriesPointResponse {
  @ApiProperty()
  date!: Date;

  @ApiProperty()
  revenue!: number;

  @ApiProperty()
  orders!: number;
}

export class TrafficSummaryResponse {
  @ApiProperty()
  totalViews!: number;

  @ApiProperty()
  uniqueVisitors!: number;
}

export class TrafficSeriesPointResponse {
  @ApiProperty()
  date!: Date;

  @ApiProperty()
  views!: number;

  @ApiProperty()
  uniqueVisitors!: number;
}

export class ConversionResponse {
  @ApiProperty()
  uniqueVisitors!: number;

  @ApiProperty()
  orders!: number;

  @ApiProperty()
  conversionRate!: number;
}

export class OrdersSummaryResponse {
  @ApiProperty()
  totalOrders!: number;

  @ApiProperty({ type: Object })
  byStatus!: Partial<Record<OrderStatus, number>>;

  @ApiProperty()
  averageOrderValue!: number;

  @ApiProperty()
  currency!: string;
}

export class TopPageResponse {
  @ApiProperty({ enum: PageViewTargetType })
  targetType!: PageViewTargetType;

  @ApiProperty()
  targetId!: string;

  @ApiProperty()
  views!: number;
}

export class VisitorsSummaryResponse {
  @ApiProperty()
  totalViews!: number;

  @ApiProperty()
  uniqueVisitors!: number;

  @ApiProperty()
  averageViewsPerVisitor!: number;

  @ApiProperty({ type: [TopPageResponse] })
  topPages!: TopPageResponse[];
}

export class AnalyticsReportResponse {
  @ApiProperty({ nullable: true })
  periodFrom!: Date | null;

  @ApiProperty({ nullable: true })
  periodTo!: Date | null;

  @ApiProperty()
  revenue!: RevenueSummaryResponse;

  @ApiProperty()
  orders!: OrdersSummaryResponse;

  @ApiProperty()
  traffic!: TrafficSummaryResponse;

  @ApiProperty()
  visitors!: VisitorsSummaryResponse;

  @ApiProperty()
  conversion!: ConversionResponse;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}
