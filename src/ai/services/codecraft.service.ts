import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClient } from '../interfaces/ai-client.interface';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * CodeCraft API client (https://codecraftapi.com) — an OpenAI-compatible
 * chat completions API.
 *
 * Structured output uses documented JSON mode (`response_format:
 * {type:"json_object"}`), not forced tool-calling: CodeCraft's tool-calling
 * path (`tools`/`tool_choice`) was verified live to return 502 consistently,
 * while plain completions and JSON mode both return 200. The target shape
 * (the same `AI_TOOLS[...].inputSchema` Anthropic uses for its tool
 * definition) is instead described directly in the prompt, since no tool
 * definition is sent.
 */
@Injectable()
export class CodeCraftService implements AiClient {
  private readonly logger = new Logger(CodeCraftService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.codecraftApiKey');
    this.model = this.configService.get<string>('ai.codecraftModel') as string;
    this.baseUrl = this.configService.get<string>(
      'ai.codecraftBaseUrl',
    ) as string;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  getModel(): string {
    return this.model;
  }

  async complete(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string> {
    const body = await this.chatCompletion({
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 300,
    });
    return body.choices?.[0]?.message?.content ?? '';
  }

  async completeStructured(params: {
    system: string;
    prompt: string;
    tool: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    };
    maxTokens?: number;
  }): Promise<unknown> {
    const instructedPrompt = [
      params.prompt,
      '',
      `Respond with ONLY a single valid JSON object — no markdown code fences, no prose before or after — matching exactly this JSON Schema (the "${params.tool.name}" shape):`,
      JSON.stringify(params.tool.inputSchema),
    ].join('\n');

    const body = await this.chatCompletion({
      system: params.system,
      prompt: instructedPrompt,
      maxTokens: params.maxTokens ?? 1024,
      jsonMode: true,
    });

    const content = body.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new Error('Model did not return the requested structured output');
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new Error('Model returned malformed structured output');
    }
  }

  private async chatCompletion(params: {
    system: string;
    prompt: string;
    maxTokens: number;
    jsonMode?: boolean;
  }): Promise<CodeCraftChatCompletion> {
    if (!this.apiKey) {
      throw new Error('CodeCraft client is not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: params.maxTokens,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.prompt },
        ],
        ...(params.jsonMode
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(
        `CodeCraft request failed: ${response.status} ${detail.slice(0, 300)}`,
      );
      throw new Error(
        `CodeCraft request failed with status ${response.status}`,
      );
    }

    try {
      return (await response.json()) as CodeCraftChatCompletion;
    } catch {
      throw new Error('CodeCraft returned a malformed response body');
    }
  }
}

interface CodeCraftChatCompletion {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
