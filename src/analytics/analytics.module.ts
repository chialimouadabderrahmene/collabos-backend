import { Module } from '@nestjs/common';
import { ConversionController } from './conversion.controller';
import { OrdersAnalyticsController } from './orders.controller';
import { ReportsController } from './reports.controller';
import { RevenueController } from './revenue.controller';
import { ConversionService } from './services/conversion.service';
import { OrdersAnalyticsService } from './services/orders-analytics.service';
import { ReportsService } from './services/reports.service';
import { RevenueService } from './services/revenue.service';
import { TrackingService } from './services/tracking.service';
import { TrafficService } from './services/traffic.service';
import { VisitorsService } from './services/visitors.service';
import { TrackingController } from './tracking.controller';
import { TrafficController } from './traffic.controller';
import { VisitorsController } from './visitors.controller';

@Module({
  controllers: [
    TrackingController,
    RevenueController,
    TrafficController,
    ConversionController,
    OrdersAnalyticsController,
    VisitorsController,
    ReportsController,
  ],
  providers: [
    TrackingService,
    RevenueService,
    TrafficService,
    ConversionService,
    OrdersAnalyticsService,
    VisitorsService,
    ReportsService,
  ],
})
export class AnalyticsModule {}
