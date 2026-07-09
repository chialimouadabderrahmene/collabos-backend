import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicService } from './anthropic.service';
import { PromptService } from './prompt.service';

describe('PromptService', () => {
  let anthropicService: {
    isConfigured: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
  };
  let service: PromptService;

  beforeEach(() => {
    anthropicService = { isConfigured: vi.fn(), complete: vi.fn() };
    service = new PromptService(
      anthropicService as unknown as AnthropicService,
    );
  });

  describe('dealHealthNarrative', () => {
    it('falls back to a deterministic summary when Anthropic is not configured', async () => {
      anthropicService.isConfigured.mockReturnValue(false);

      const result = await service.dealHealthNarrative({
        dealTitle: 'Summer Collab',
        score: 80,
        riskFactors: [],
      });

      expect(result.generatedByAi).toBe(false);
      expect(result.text).toContain('Summer Collab');
      expect(anthropicService.complete).not.toHaveBeenCalled();
    });

    it('returns the AI-generated text when configured and successful', async () => {
      anthropicService.isConfigured.mockReturnValue(true);
      anthropicService.complete.mockResolvedValue('This deal looks great.');

      const result = await service.dealHealthNarrative({
        dealTitle: 'Summer Collab',
        score: 80,
        riskFactors: [],
      });

      expect(result).toEqual({
        text: 'This deal looks great.',
        generatedByAi: true,
      });
    });

    it('falls back when Anthropic throws', async () => {
      anthropicService.isConfigured.mockReturnValue(true);
      anthropicService.complete.mockRejectedValue(new Error('rate limited'));

      const result = await service.dealHealthNarrative({
        dealTitle: 'Summer Collab',
        score: 80,
        riskFactors: ['1 milestone(s) overdue'],
      });

      expect(result.generatedByAi).toBe(false);
      expect(result.text).toContain('Summer Collab');
    });

    it('falls back when Anthropic returns empty text', async () => {
      anthropicService.isConfigured.mockReturnValue(true);
      anthropicService.complete.mockResolvedValue('');

      const result = await service.dealHealthNarrative({
        dealTitle: 'Summer Collab',
        score: 80,
        riskFactors: [],
      });

      expect(result.generatedByAi).toBe(false);
    });
  });

  describe('brandMatchNarrative', () => {
    it('builds a deterministic fallback mentioning the brand name', async () => {
      anthropicService.isConfigured.mockReturnValue(false);

      const result = await service.brandMatchNarrative({
        brandName: 'Acme',
        score: 70,
        overlapCategories: ['Streetwear'],
      });

      expect(result.text).toContain('Acme');
      expect(result.text).toContain('Streetwear');
    });
  });

  describe('revenuePredictionNarrative', () => {
    it('builds a deterministic fallback mentioning the trend', async () => {
      anthropicService.isConfigured.mockReturnValue(false);

      const result = await service.revenuePredictionNarrative({
        brandName: 'Acme',
        trend: 'up',
        predicted: [100, 200],
        currency: 'USD',
      });

      expect(result.text).toContain('up');
    });
  });

  describe('launchReadinessNarrative', () => {
    it('lists blockers in the deterministic fallback', async () => {
      anthropicService.isConfigured.mockReturnValue(false);

      const result = await service.launchReadinessNarrative({
        dropTitle: 'Fall Drop',
        score: 40,
        blockers: ['No media has been uploaded'],
      });

      expect(result.text).toContain('No media has been uploaded');
    });
  });

  describe('recommendationReason', () => {
    it('mentions overlap categories in the deterministic fallback', async () => {
      anthropicService.isConfigured.mockReturnValue(false);

      const result = await service.recommendationReason({
        briefTitle: 'Look book shoot',
        brandName: 'Acme',
        score: 60,
        overlapCategories: ['Footwear'],
      });

      expect(result.text).toContain('Footwear');
    });
  });
});
