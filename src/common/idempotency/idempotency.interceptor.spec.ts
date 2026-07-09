import { ConflictException } from '@nestjs/common';
import { Observable, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisLockService } from '../locking/redis-lock.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function buildContext(headers: Record<string, string | undefined>) {
  const request = {
    header: (name: string) => headers[name.toLowerCase()],
    originalUrl: '/v1/payments/orders',
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('IdempotencyInterceptor', () => {
  let prisma: {
    idempotencyKey: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let redisLockService: {
    acquire: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    prisma = {
      idempotencyKey: { findUnique: vi.fn(), create: vi.fn() },
    };
    redisLockService = {
      acquire: vi.fn().mockResolvedValue('token-1'),
      release: vi.fn().mockResolvedValue(true),
    };
    interceptor = new IdempotencyInterceptor(
      prisma as unknown as PrismaService,
      redisLockService as unknown as RedisLockService,
    );
  });

  it('passes requests through untouched when no key header is present', async () => {
    const handler = { handle: () => of({ id: 'payment-1' }) };

    const result$ = await interceptor.intercept(
      buildContext({}),
      handler as never,
    );

    expect(await firstValueFrom(result$)).toEqual({ id: 'payment-1' });
    expect(redisLockService.acquire).not.toHaveBeenCalled();
  });

  it('rejects when a request with the same key is already in flight', async () => {
    redisLockService.acquire.mockResolvedValue(null);
    const handler = { handle: () => of({ id: 'payment-1' }) };

    await expect(
      interceptor.intercept(
        buildContext({ 'idempotency-key': 'key-1' }),
        handler as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('runs the handler and persists the response on first use of a key', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    const handler = { handle: () => of({ id: 'payment-1' }) };

    const result$ = await interceptor.intercept(
      buildContext({ 'idempotency-key': 'key-1' }),
      handler as never,
    );

    expect(await firstValueFrom(result$)).toEqual({ id: 'payment-1' });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: {
        key: 'key-1',
        requestPath: '/v1/payments/orders',
        responseBody: { id: 'payment-1' },
        statusCode: 201,
      },
    });
    expect(redisLockService.release).toHaveBeenCalledWith(
      'idempotency:key-1',
      'token-1',
    );
  });

  it('returns the cached response without re-running the handler on replay', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: 'key-1',
      requestPath: '/v1/payments/orders',
      responseBody: { id: 'payment-1' },
      statusCode: 201,
    });
    const handler = { handle: vi.fn() };

    const result$ = await interceptor.intercept(
      buildContext({ 'idempotency-key': 'key-1' }),
      handler as never,
    );

    expect(await firstValueFrom(result$)).toEqual({ id: 'payment-1' });
    expect(handler.handle).not.toHaveBeenCalled();
    expect(redisLockService.release).toHaveBeenCalledWith(
      'idempotency:key-1',
      'token-1',
    );
  });

  it('rejects reuse of the same key against a different endpoint', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: 'key-1',
      requestPath: '/v1/payments/deals',
      responseBody: { id: 'payment-1' },
      statusCode: 201,
    });
    const handler = { handle: vi.fn() };

    await expect(
      interceptor.intercept(
        buildContext({ 'idempotency-key': 'key-1' }),
        handler as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases the lock without caching a response when the handler errors', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    const handler = {
      handle: () =>
        new Observable((subscriber) => subscriber.error(new Error('boom'))),
    };

    const result$ = await interceptor.intercept(
      buildContext({ 'idempotency-key': 'key-1' }),
      handler as never,
    );

    await expect(firstValueFrom(result$)).rejects.toThrow('boom');
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(redisLockService.release).toHaveBeenCalledWith(
      'idempotency:key-1',
      'token-1',
    );
  });
});
