import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationIdMiddleware } from './common/logging/correlation-id.middleware';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BrandsModule } from './brands/brands.module';
import { BriefsModule } from './briefs/briefs.module';
import { ApplicationsModule } from './applications/applications.module';
import { MessagingModule } from './messaging/messaging.module';
import { DealsModule } from './deals/deals.module';
import { ContractsModule } from './contracts/contracts.module';
import { DropsModule } from './drops/drops.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PayoutsModule } from './payouts/payouts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { AdminModule } from './admin/admin.module';
import { ObservabilityModule } from './observability/observability.module';
import { EventsModule } from './events/events.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('throttle.ttlMs') ?? 60000,
          limit: configService.get<number>('throttle.limit') ?? 100,
        },
      ],
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    WebsocketModule,
    HealthModule,
    MailModule,
    AuthModule,
    UsersModule,
    BrandsModule,
    BriefsModule,
    ApplicationsModule,
    MessagingModule,
    DealsModule,
    ContractsModule,
    DropsModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    PayoutsModule,
    AnalyticsModule,
    NotificationsModule,
    AiModule,
    AdminModule,
    ObservabilityModule,
    EventsModule,
    SearchModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
