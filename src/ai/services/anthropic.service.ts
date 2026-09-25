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

  getModel(): string {
    return this.model;
  }

  /**
   * Structured completion: forces the model to answer by calling a single
   * tool whose `input_schema` describes the expected JSON, and returns that
   * tool input. Callers must still validate the returned value.
   */
  async completeStructured(params: {
    system: string;
    prompt: string;
    tool: {
      name: string;
      description: string;
      inputSchema: Anthropic.Messages.Tool.InputSchema;
    };
    maxTokens?: number;
  }): Promise<unknown> {
    if (!this.client) {
      throw new Error('Anthropic client is not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: [{ role: 'user', content: params.prompt }],
      tools: [
        {
          name: params.tool.name,
          description: params.tool.description,
          input_schema: params.tool.inputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: params.tool.name },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === 'tool_use' && block.name === params.tool.name,
    );

    if (!toolUse) {
      throw new Error('Model did not return the requested structured output');
    }

    return toolUse.input;
  }
}
