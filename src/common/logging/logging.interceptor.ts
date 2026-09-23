import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { redactUrl } from './redact-url';
import { getRequestId } from './request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, start),
        error: () => this.log(request, response.statusCode || 500, start, true),
      }),
    );
  }

  private log(
    request: Request,
    statusCode: number,
    start: number,
    isError = false,
  ): void {
    const durationMs = Date.now() - start;
    const requestId = getRequestId() ?? '-';
    const message = `${request.method} ${redactUrl(request.originalUrl)} ${statusCode} ${durationMs}ms [${requestId}]`;

    if (isError || statusCode >= 500) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
