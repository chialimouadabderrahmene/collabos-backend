import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { redactUrl } from '../logging/redact-url';
import { getRequestId } from '../logging/request-context';

interface ErrorResponseBody {
  statusCode: number;
  /** Stable, machine-readable error code (e.g. `CONFLICT`, or an
   * application-supplied code such as `REVISION_CONFLICT`). */
  code: string;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
  /** Extra structured fields supplied by the HttpException body (e.g.
   * `currentRevision` on a 409), when present. */
  details?: Record<string, unknown>;
  requestId?: string;
}

const STANDARD_ERROR_KEYS = new Set(['message', 'error', 'statusCode', 'code']);
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

const INTERNAL_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;
const INTERNAL_ERROR_MESSAGE = 'Internal server error';
const INTERNAL_ERROR_NAME = 'InternalServerError';
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

/**
 * Global error boundary.
 *
 * Only deliberately thrown HttpExceptions describe themselves to clients
 * (message, `details`, optional `code`). Anything else — Prisma errors,
 * driver/network errors, programming errors — and every plain 500 is
 * replaced by a generic body, so raw library messages, stack traces,
 * filesystem paths, connection strings or secrets never reach the client.
 * The full error is still logged and reported to Sentry, correlated by
 * `requestId`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : INTERNAL_ERROR_STATUS;

    // A 500 is by definition unexpected, even when wrapped in an
    // HttpException, so it is never described to the client.
    const isPublic = isHttpException && statusCode !== INTERNAL_ERROR_STATUS;
    const exceptionResponse = isPublic ? exception.getResponse() : null;

    const requestId = getRequestId();
    const path = redactUrl(request.url);
    const details = isPublic
      ? this.extractDetails(exceptionResponse)
      : undefined;

    const body: ErrorResponseBody = {
      statusCode,
      code: isPublic
        ? this.extractCode(exceptionResponse, statusCode)
        : INTERNAL_ERROR_CODE,
      timestamp: new Date().toISOString(),
      path,
      method: request.method,
      message: isPublic
        ? this.extractMessage(exceptionResponse, exception)
        : INTERNAL_ERROR_MESSAGE,
      error: isPublic
        ? this.extractError(exceptionResponse, exception)
        : INTERNAL_ERROR_NAME,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${statusCode}${
          requestId ? ` [${requestId}]` : ''
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    } else {
      this.logger.warn(`${request.method} ${path} -> ${statusCode}`);
    }

    response.status(statusCode).json(body);
  }

  private extractCode(
    exceptionResponse: string | object | null,
    statusCode: number,
  ): string {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeCode = (exceptionResponse as Record<string, unknown>).code;
      if (typeof maybeCode === 'string' && ERROR_CODE_PATTERN.test(maybeCode)) {
        return maybeCode;
      }
    }
    const statusName = (HttpStatus as Record<number, string | undefined>)[
      statusCode
    ];
    return statusName ?? 'HTTP_ERROR';
  }

  private extractDetails(
    exceptionResponse: string | object | null,
  ): Record<string, unknown> | undefined {
    if (!exceptionResponse || typeof exceptionResponse !== 'object') {
      return undefined;
    }
    const extra = Object.entries(exceptionResponse).filter(
      ([key]) => !STANDARD_ERROR_KEYS.has(key),
    );
    return extra.length > 0 ? Object.fromEntries(extra) : undefined;
  }

  private extractMessage(
    exceptionResponse: string | object | null,
    exception: HttpException,
  ): string | string[] {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeMessage = (exceptionResponse as Record<string, unknown>)
        .message;
      if (typeof maybeMessage === 'string' || Array.isArray(maybeMessage)) {
        return maybeMessage as string | string[];
      }
    }
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    return exception.message;
  }

  private extractError(
    exceptionResponse: string | object | null,
    exception: HttpException,
  ): string {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeError = (exceptionResponse as Record<string, unknown>).error;
      if (typeof maybeError === 'string') {
        return maybeError;
      }
    }
    return exception.name;
  }
}
