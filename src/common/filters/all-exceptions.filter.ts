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

const STANDARD_ERROR_KEYS = new Set(['message', 'error', 'statusCode']);

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
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    const message = this.extractMessage(exceptionResponse, exception);
    const error = this.extractError(exceptionResponse, exception);

    const details = this.extractDetails(exceptionResponse);
    const requestId = getRequestId();
    const path = redactUrl(request.url);

    const body: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      method: request.method,
      message,
      error,
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    } else {
      this.logger.warn(`${request.method} ${path} -> ${statusCode}`);
    }

    response.status(statusCode).json(body);
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
    exception: unknown,
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
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }

  private extractError(
    exceptionResponse: string | object | null,
    exception: unknown,
  ): string {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeError = (exceptionResponse as Record<string, unknown>).error;
      if (typeof maybeError === 'string') {
        return maybeError;
      }
    }
    if (exception instanceof HttpException) {
      return exception.name;
    }
    return 'InternalServerError';
  }
}
