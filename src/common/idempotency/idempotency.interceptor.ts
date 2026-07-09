import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { finalize, of, switchMap } from 'rxjs';
import { RedisLockService } from '../locking/redis-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const LOCK_TTL_MS = 10000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLockService: RedisLockService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.header(IDEMPOTENCY_KEY_HEADER);

    if (!key) {
      return next.handle();
    }

    const lockKey = `idempotency:${key}`;
    const token = await this.redisLockService.acquire(lockKey, LOCK_TTL_MS);

    if (!token) {
      throw new ConflictException(
        'A request with this Idempotency-Key is already in progress',
      );
    }

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      await this.redisLockService.release(lockKey, token);

      if (existing.requestPath !== request.originalUrl) {
        throw new ConflictException(
          'This Idempotency-Key was already used for a different request',
        );
      }

      return of(existing.responseBody);
    }

    return next.handle().pipe(
      switchMap(async (responseBody: unknown) => {
        await this.prisma.idempotencyKey.create({
          data: {
            key,
            requestPath: request.originalUrl,
            responseBody: responseBody as Prisma.InputJsonValue,
            statusCode: 201,
          },
        });
        return responseBody;
      }),
      finalize(() => {
        void this.redisLockService.release(lockKey, token);
      }),
    );
  }
}
