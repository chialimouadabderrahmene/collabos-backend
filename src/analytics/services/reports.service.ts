import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { AnalyticsGranularity } from '../dto/analytics-series-query.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { AnalyticsReportResponse } from '../types/analytics-response.types';
import { resolveDateRange } from '../utils/resolve-date-range.util';
import { ConversionService } from './conversion.service';
import { OrdersAnalyticsService } from './orders-analytics.service';
import { RevenueService } from './revenue.service';
import { TrafficService } from './traffic.service';
import { VisitorsService } from './visitors.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly revenueService: RevenueService,
    private readonly ordersAnalyticsService: OrdersAnalyticsService,
    private readonly trafficService: TrafficService,
    private readonly visitorsService: VisitorsService,
    private readonly conversionService: ConversionService,
  ) {}

  async getSummary(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<AnalyticsReportResponse> {
    const { from, to } = resolveDateRange(query);

    const [revenue, orders, traffic, visitors, conversion] = await Promise.all([
      this.revenueService.getSummary(query, user),
      this.ordersAnalyticsService.getSummary(query, user),
      this.trafficService.getSummary(query, user),
      this.visitorsService.getSummary(query, user),
      this.conversionService.getConversion(query, user),
    ]);

    return {
      periodFrom: from,
      periodTo: to,
      revenue,
      orders,
      traffic,
      visitors,
      conversion,
    };
  }

  async exportCsv(
    query: AnalyticsQueryDto,
    user: AuthenticatedUser,
  ): Promise<string> {
    const seriesQuery = { ...query, granularity: AnalyticsGranularity.DAY };

    const [revenueSeries, trafficSeries] = await Promise.all([
      this.revenueService.getSeries(seriesQuery, user),
      this.trafficService.getSeries(seriesQuery, user),
    ]);

    const trafficByDate = new Map(
      trafficSeries.map((point) => [point.date.toISOString(), point]),
    );

    const header = 'date,revenue,orders,views,uniqueVisitors';
    const rows = revenueSeries.map((point) => {
      const traffic = trafficByDate.get(point.date.toISOString());
      return [
        point.date.toISOString(),
        point.revenue,
        point.orders,
        traffic?.views ?? 0,
        traffic?.uniqueVisitors ?? 0,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }
}
