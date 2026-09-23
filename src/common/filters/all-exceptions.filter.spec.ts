import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        message: 'Internal server error',
        error: 'InternalServerError',
        code: 'INTERNAL_ERROR',
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

  describe('internal error sanitization', () => {
    const LEAKY_PRISMA_MESSAGE = [
      'Invalid `prisma.opportunity.create()` invocation in',
      '/app/node_modules/.prisma/client/index.js:48:45',
      'C:/Users/deploy/collabos/dist/opportunities/opportunities.service.js',
      "Can't reach database server at postgresql://collabos:s3cret@db.internal:5432/collabos",
    ].join('\n');

    function bodyFor(exception: unknown): Record<string, unknown> {
      requestContext.run({ requestId: 'req-500' }, () => {
        filter.catch(exception, buildHost(request, { status }));
      });
      return json.mock.calls[0][0] as Record<string, unknown>;
    }

    it('does not leak raw Prisma error text', () => {
      const body = bodyFor(
        new Prisma.PrismaClientKnownRequestError(LEAKY_PRISMA_MESSAGE, {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
      const serialized = JSON.stringify(body);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(body).toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        error: 'InternalServerError',
      });
      expect(serialized).not.toMatch(/prisma/i);
      expect(serialized).not.toContain('P2002');
      expect(serialized).not.toContain('postgresql://');
      expect(serialized).not.toContain('s3cret');
      expect(body).not.toHaveProperty('details');
    });

    it('does not leak filesystem paths', () => {
      const serialized = JSON.stringify(
        bodyFor(new Error(LEAKY_PRISMA_MESSAGE)),
      );

      expect(serialized).not.toContain('node_modules');
      expect(serialized).not.toContain('/app/');
      expect(serialized).not.toContain('C:/Users');
      expect(serialized).not.toContain('opportunities.service');
      expect(serialized).not.toContain('.js:');
    });

    it('does not leak stack traces', () => {
      const error = new TypeError('Cannot read properties of undefined');
      const serialized = JSON.stringify(bodyFor(error));

      expect(error.stack).toBeDefined();
      expect(serialized).not.toContain('    at ');
      expect(serialized).not.toContain('TypeError');
      expect(serialized).not.toContain('Cannot read properties');
    });

    it('never describes a 500 even when thrown as an HttpException', () => {
      const body = bodyFor(
        new InternalServerErrorException({
          message: `failed: ${LEAKY_PRISMA_MESSAGE}`,
          secret: 'storage-signing-secret',
        }),
      );

      expect(body.message).toBe('Internal server error');
      expect(JSON.stringify(body)).not.toContain('storage-signing-secret');
      expect(body).not.toHaveProperty('details');
    });

    it('keeps intentional 5xx messages (e.g. AI provider failures) without internals', () => {
      const body = bodyFor(
        new BadGatewayException('The AI provider request failed'),
      );

      expect(body).toMatchObject({
        statusCode: 502,
        code: 'BAD_GATEWAY',
        message: 'The AI provider request failed',
      });
    });

    it('keeps the request ID on sanitized 500s for support correlation', () => {
      expect(bodyFor(new Error(LEAKY_PRISMA_MESSAGE)).requestId).toBe(
        'req-500',
      );
    });

    it('still reports the full original error to Sentry', () => {
      const error = new Error(LEAKY_PRISMA_MESSAGE);
      bodyFor(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('application-level errors stay useful', () => {
    it('keeps safe details and an application-supplied code', () => {
      filter.catch(
        new ConflictException({
          message: 'Draft revision conflict',
          code: 'REVISION_CONFLICT',
          currentRevision: 8,
        }),
        buildHost(request, { status }),
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          code: 'REVISION_CONFLICT',
          message: 'Draft revision conflict',
          details: { currentRevision: 8 },
        }),
      );
    });

    it('derives a stable code from the status when none is supplied', () => {
      filter.catch(
        new ConflictException({ message: 'Stale draft', currentRevision: 7 }),
        buildHost(request, { status }),
      );

      const body = json.mock.calls[0][0] as Record<string, unknown>;
      expect(body.code).toBe('CONFLICT');
      expect(body.details).toEqual({ currentRevision: 7 });
    });

    it('keeps validation messages intact', () => {
      filter.catch(
        new BadRequestException(['title must be a string']),
        buildHost(request, { status }),
      );

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BAD_REQUEST',
          message: ['title must be a string'],
        }),
      );
    });

    it('ignores malformed application codes', () => {
      filter.catch(
        new ConflictException({ message: 'x', code: 'drop table; --' }),
        buildHost(request, { status }),
      );

      const body = json.mock.calls[0][0] as Record<string, unknown>;
      expect(body.code).toBe('CONFLICT');
      expect(body).not.toHaveProperty('details');
    });
  });
});
