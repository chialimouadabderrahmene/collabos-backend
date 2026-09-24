import type { OrderStatus } from "./orders";
import { http } from "./http";

export type Granularity = "day" | "week" | "month";

export interface AnalyticsRange {
  brandId: string;
  from?: string;
  to?: string;
}

export interface RevenueSummary {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  currency: string;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TrafficSummary {
  totalViews: number;
  uniqueVisitors: number;
}

export interface TrafficPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface Conversion {
  uniqueVisitors: number;
  orders: number;
  /** 0–1 ratio. */
  conversionRate: number;
}

export interface OrdersSummary {
  totalOrders: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  averageOrderValue: number;
  currency: string;
}

export interface TopPage {
  targetType: "BRAND" | "PRODUCT" | "DROP";
  targetId: string;
  views: number;
}

export interface VisitorsSummary {
  totalViews: number;
  uniqueVisitors: number;
  averageViewsPerVisitor: number;
  topPages: TopPage[];
}

export interface AnalyticsReport {
  periodFrom: string | null;
  periodTo: string | null;
  revenue: RevenueSummary;
  orders: OrdersSummary;
  traffic: TrafficSummary;
  visitors: VisitorsSummary;
  conversion: Conversion;
}

/** All endpoints are brand-owner only (enforced server-side). */
export const analyticsApi = {
  report: (range: AnalyticsRange) => http.get<AnalyticsReport>("analytics/reports/summary", { ...range }),
  revenueChart: (range: AnalyticsRange & { granularity: Granularity }) =>
    http.get<RevenuePoint[]>("analytics/revenue/chart", { ...range }),
  trafficChart: (range: AnalyticsRange & { granularity: Granularity }) =>
    http.get<TrafficPoint[]>("analytics/traffic/chart", { ...range }),
  /** Same-origin CSV download through the BFF (cookie-authenticated). */
  exportUrl: (range: AnalyticsRange) => {
    const search = new URLSearchParams(
      Object.entries(range).filter(([, value]) => !!value) as Array<[string, string]>,
    );
    return `/api/backend/analytics/reports/export?${search.toString()}`;
  },
};
