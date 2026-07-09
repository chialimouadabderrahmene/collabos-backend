import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('getMetrics', () => {
    it('exposes default process metrics in Prometheus exposition format', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('process_cpu_user_seconds_total');
    });

    it('records observed HTTP request durations in the histogram', async () => {
      service.observeHttpRequest('GET', '/health', 200, 0.05);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/health"');
      expect(metrics).toContain('status_code="200"');
    });
  });

  describe('getContentType', () => {
    it('returns the Prometheus exposition content type', () => {
      expect(service.getContentType()).toContain('text/plain');
    });
  });
});
