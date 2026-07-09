import { Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggingInterceptor } from './logging.interceptor';

function buildHttpContext(request: object, response: object) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  it('passes through non-http contexts untouched', async () => {
    const context = { getType: () => 'rpc' } as never;
    const handler = { handle: () => of('result') };

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toBe('result');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs a successful request at log level', async () => {
    const context = buildHttpContext(
      { method: 'GET', originalUrl: '/orders' },
      { statusCode: 200 },
    );
    const handler = { handle: () => of({ ok: true }) };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('GET /orders 200');
  });

  it('logs a failed request at warn level', async () => {
    const context = buildHttpContext(
      { method: 'POST', originalUrl: '/payments/orders' },
      { statusCode: 500 },
    );
    const handler = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('boom');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('POST /payments/orders 500');
  });
});
