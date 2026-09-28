import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiClient } from '../interfaces/ai-client.interface';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * CodeCraft API client (https://codecraftapi.com) — an OpenAI-compatible
 * chat completions API. Structured output is obtained the same way OpenAI's
 * API does it: a single forced tool/function call whose arguments are the
 * JSON we want.
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
    const body = await this.chatCompletion({
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 1024,
      tool: params.tool,
    });

    const toolCall = body.choices?.[0]?.message?.tool_calls?.find(
      (call) => call.function?.name === params.tool.name,
    );
    if (!toolCall?.function) {
      throw new Error('Model did not return the requested structured output');
    }

    try {
      return JSON.parse(toolCall.function.arguments) as unknown;
    } catch {
      throw new Error('Model returned malformed structured output');
    }
  }

  private async chatCompletion(params: {
    system: string;
    prompt: string;
    maxTokens: number;
    tool?: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    };
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
        ...(params.tool
          ? {
              tools: [
                {
                  type: 'function',
                  function: {
                    name: params.tool.name,
                    description: params.tool.description,
                    parameters: params.tool.inputSchema,
                  },
                },
              ],
              tool_choice: {
                type: 'function',
                function: { name: params.tool.name },
              },
            }
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
      tool_calls?: Array<{
        function?: { name: string; arguments: string };
      }>;
    };
  }>;
}
