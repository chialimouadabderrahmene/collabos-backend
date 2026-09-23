import {
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestContext } from '../logging/request-context';
import { AllExceptionsFilter } from './all-exceptions.filter';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

function buildHost(
  request: { method: string; url: string },
  response: { status: ReturnType<typeof vi.fn> },
) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let request: { method: string; url: string };
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new AllExceptionsFilter();
    request = { method: 'POST', url: '/orders' };
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });
  });

  it('maps an HttpException to its status and message', () => {
    filter.catch(
      new BadRequestException('Invalid payload'),
      buildHost(request, { status }),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid payload',
      }),
    );
  });

  it('maps an unknown error to a 500 with a generic message', () => {
    filter.catch(new Error('boom'), buildHost(request, { status }));

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'boom',
        error: 'InternalServerError',
      }),
    );
  });

  it('omits requestId when no request context is active', () => {
    filter.catch(new Error('boom'), buildHost(request, { status }));

    const body = json.mock.calls[0][0] as { requestId?: string };
    expect(body.requestId).toBeUndefined();
  });

  it('includes requestId when a request context is active', () => {
    requestContext.run({ requestId: 'req-abc' }, () => {
      filter.catch(new Error('boom'), buildHost(request, { status }));
    });

    const body = json.mock.calls[0][0] as { requestId?: string };
    expect(body.requestId).toBe('req-abc');
  });

  it('reports 5xx errors to Sentry', () => {
    const error = new Error('boom');
    filter.catch(error, buildHost(request, { status }));

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('does not report 4xx errors to Sentry', () => {
    filter.catch(
      new BadRequestException('Invalid payload'),
      buildHost(request, { status }),
    );

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('passes extra structured fields through as details', () => {
    filter.catch(
      new ConflictException({ message: 'Stale draft', currentRevision: 7 }),
      buildHost(request, { status }),
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'Stale draft',
        details: { currentRevision: 7 },
      }),
    );
  });

  it('omits details for standard exceptions', () => {
    filter.catch(new BadRequestException('x'), buildHost(request, { status }));

    const body = json.mock.calls[0][0] as { details?: unknown };
    expect(body.details).toBeUndefined();
  });

  it('redacts share tokens from the echoed path', () => {
    filter.catch(
      new BadRequestException('x'),
      buildHost({ method: 'GET', url: '/v1/share/secret-token' }, { status }),
    );

    const body = json.mock.calls[0][0] as { path: string };
    expect(body.path).toBe('/v1/share/[redacted]');
  });
});
