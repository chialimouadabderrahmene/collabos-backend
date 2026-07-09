import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisLockService } from '../common/locking/redis-lock.service';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          maxRetriesPerRequest: null,
        });
      },
      inject: [ConfigService],
    },
    RedisService,
    RedisLockService,
  ],
  exports: [REDIS_CLIENT, RedisService, RedisLockService],
})
export class RedisModule {}
