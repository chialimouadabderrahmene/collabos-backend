import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics/metrics.service';

describe('MetricsController', () => {
  let metricsService: {
    getMetrics: ReturnType<typeof vi.fn>;
    getContentType: ReturnType<typeof vi.fn>;
  };
  let response: { setHeader: ReturnType<typeof vi.fn> };
  let controller: MetricsController;

  beforeEach(() => {
    metricsService = {
      getMetrics: vi.fn().mockResolvedValue('metric_name 1'),
      getContentType: vi.fn().mockReturnValue('text/plain; version=0.0.4'),
    };
    response = { setHeader: vi.fn() };
    controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );
  });

  describe('getMetrics', () => {
    it('sets the Prometheus content type and returns the exposition body', async () => {
      const result = await controller.getMetrics(response as never);

      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4',
      );
      expect(result).toBe('metric_name 1');
    });
  });
});
