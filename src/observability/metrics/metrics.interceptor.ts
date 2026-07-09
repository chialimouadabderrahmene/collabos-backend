import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const record = (): void => {
      const durationSeconds =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;
      const route = this.routeLabel(request);
      this.metricsService.observeHttpRequest(
        request.method,
        route,
        response.statusCode,
        durationSeconds,
      );
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }

  private routeLabel(request: Request): string {
    const routePath = (request.route as { path?: string } | undefined)?.path;
    return routePath ? `${request.baseUrl}${routePath}` : request.path;
  }
}
