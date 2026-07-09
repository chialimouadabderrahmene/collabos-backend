import { Injectable } from '@nestjs/common';
import { AnthropicService } from './anthropic.service';

export interface AiNarrative {
  text: string;
  generatedByAi: boolean;
}

@Injectable()
export class PromptService {
  constructor(private readonly anthropicService: AnthropicService) {}

  dealHealthNarrative(input: {
    dealTitle: string;
    score: number;
    riskFactors: string[];
  }): Promise<AiNarrative> {
    const fallback =
      input.riskFactors.length === 0
        ? `"${input.dealTitle}" is healthy with a score of ${input.score}/100.`
        : `"${input.dealTitle}" scores ${input.score}/100. Watch for: ${input.riskFactors.join('; ')}.`;

    return this.generate(
      'You are a concise collaboration-deal analyst for a fashion marketplace. Reply with one or two plain-English sentences, no markdown.',
      `Deal "${input.dealTitle}" has a health score of ${input.score}/100. Risk factors: ${
        input.riskFactors.length ? input.riskFactors.join(', ') : 'none'
      }. Summarize the deal's health for the brand and creator.`,
      fallback,
    );
  }

  brandMatchNarrative(input: {
    brandName: string;
    score: number;
    overlapCategories: string[];
  }): Promise<AiNarrative> {
    const fallback =
      input.overlapCategories.length > 0
        ? `${input.brandName} is a ${input.score}/100 match, sharing ${input.overlapCategories.join(', ')}.`
        : `${input.brandName} is a ${input.score}/100 match based on overall track record.`;

    return this.generate(
      'You are a concise creator-brand matchmaking analyst for a fashion marketplace. Reply with one plain-English sentence, no markdown.',
      `Match score with brand "${input.brandName}" is ${input.score}/100. Shared categories: ${
        input.overlapCategories.length
          ? input.overlapCategories.join(', ')
          : 'none'
      }. Explain why this could be a good collaboration fit.`,
      fallback,
    );
  }

  revenuePredictionNarrative(input: {
    brandName: string;
    trend: 'up' | 'down' | 'flat';
    predicted: number[];
    currency: string;
  }): Promise<AiNarrative> {
    const fallback = `${input.brandName} revenue trend is ${input.trend}. Next period projection: ${input.predicted
      .map((amount) => `${amount} ${input.currency}`)
      .join(', ')}.`;

    return this.generate(
      'You are a concise revenue forecasting analyst for a fashion marketplace. Reply with one or two plain-English sentences, no markdown.',
      `Brand "${input.brandName}" revenue trend is ${input.trend}. Projected revenue for the next periods: ${input.predicted.join(
        ', ',
      )} ${input.currency}. Summarize the outlook.`,
      fallback,
    );
  }

  launchReadinessNarrative(input: {
    dropTitle: string;
    score: number;
    blockers: string[];
  }): Promise<AiNarrative> {
    const fallback =
      input.blockers.length === 0
        ? `"${input.dropTitle}" is ready to launch (${input.score}/100).`
        : `"${input.dropTitle}" is ${input.score}/100 ready. Missing: ${input.blockers.join('; ')}.`;

    return this.generate(
      'You are a concise product-launch readiness analyst for a fashion marketplace. Reply with one or two plain-English sentences, no markdown.',
      `Drop "${input.dropTitle}" has a launch readiness score of ${input.score}/100. Missing items: ${
        input.blockers.length ? input.blockers.join(', ') : 'none'
      }. Summarize what's left before this drop can launch.`,
      fallback,
    );
  }

  recommendationReason(input: {
    briefTitle: string;
    brandName: string;
    score: number;
    overlapCategories: string[];
  }): Promise<AiNarrative> {
    const fallback =
      input.overlapCategories.length > 0
        ? `Matches your experience in ${input.overlapCategories.join(', ')}.`
        : `Matches your overall creator profile (${input.score}/100).`;

    return this.generate(
      'You are a concise creator-opportunity recommender for a fashion marketplace. Reply with one short plain-English sentence, no markdown.',
      `Recommending brief "${input.briefTitle}" from brand "${input.brandName}" with match score ${
        input.score
      }/100. Shared categories: ${
        input.overlapCategories.length
          ? input.overlapCategories.join(', ')
          : 'none'
      }. Write a one-sentence reason this creator should apply.`,
      fallback,
    );
  }

  private async generate(
    system: string,
    prompt: string,
    fallback: string,
  ): Promise<AiNarrative> {
    if (!this.anthropicService.isConfigured()) {
      return { text: fallback, generatedByAi: false };
    }

    try {
      const text = await this.anthropicService.complete({ system, prompt });
      return text
        ? { text, generatedByAi: true }
        : { text: fallback, generatedByAi: false };
    } catch {
      return { text: fallback, generatedByAi: false };
    }
  }
}
