import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

function buildHttpContext(request: object, response: object) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe('MetricsInterceptor', () => {
  let metricsService: { observeHttpRequest: ReturnType<typeof vi.fn> };
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    metricsService = { observeHttpRequest: vi.fn() };
    interceptor = new MetricsInterceptor(
      metricsService as unknown as MetricsService,
    );
  });

  it('passes through non-http contexts without recording anything', async () => {
    const context = { getType: () => 'rpc' } as never;
    const handler = { handle: () => of('result') };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(metricsService.observeHttpRequest).not.toHaveBeenCalled();
  });

  it('records the request using the matched route pattern, not the raw URL', async () => {
    const context = buildHttpContext(
      {
        method: 'GET',
        baseUrl: '',
        path: '/payments/123',
        route: { path: '/payments/:id' },
      },
      { statusCode: 200 },
    );
    const handler = { handle: () => of({ id: '123' }) };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(metricsService.observeHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/payments/:id',
      200,
      expect.any(Number),
    );
  });

  it('falls back to the raw path when no route was matched (e.g. a 404)', async () => {
    const context = buildHttpContext(
      { method: 'GET', baseUrl: '', path: '/unknown', route: undefined },
      { statusCode: 404 },
    );
    const handler = { handle: () => of(undefined) };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(metricsService.observeHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/unknown',
      404,
      expect.any(Number),
    );
  });

  it('still records a failed request', async () => {
    const context = buildHttpContext(
      {
        method: 'POST',
        baseUrl: '',
        path: '/payments/orders',
        route: { path: '/payments/orders' },
      },
      { statusCode: 500 },
    );
    const handler = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('boom');

    expect(metricsService.observeHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/payments/orders',
      500,
      expect.any(Number),
    );
  });
});
