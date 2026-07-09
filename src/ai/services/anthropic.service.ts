import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private readonly client: Anthropic | undefined;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.anthropicApiKey');
    this.model = this.configService.get<string>('ai.model') as string;
    this.client = apiKey ? new Anthropic({ apiKey }) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  async complete(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string> {
    if (!this.client) {
      throw new Error('Anthropic client is not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 300,
      system: params.system,
      messages: [{ role: 'user', content: params.prompt }],
    });

    const [block] = response.content;
    return block?.type === 'text' ? block.text : '';
  }
}
