import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DROPS_QUEUE } from '../drops/services/drops.service';
import { NOTIFICATIONS_QUEUE } from '../notifications/constants/notifications-queue.constant';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { MetricsController } from './metrics.controller';
import { QueuesController } from './queues.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: DROPS_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
    ),
  ],
  controllers: [QueuesController, MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class ObservabilityModule {}
