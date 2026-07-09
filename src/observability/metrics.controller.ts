import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics/metrics.service';

@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  async getMetrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.setHeader('Content-Type', this.metricsService.getContentType());
    return this.metricsService.getMetrics();
  }
}
