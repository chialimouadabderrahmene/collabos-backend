/**
 * Shared shape for a structured-completion AI provider. `AnthropicService`
 * and `CodeCraftService` both implement this so callers (e.g.
 * `OpportunityAiService`) can depend on the interface rather than a
 * concrete provider.
 */
export interface AiClient {
  isConfigured(): boolean;
  getModel(): string;
  complete(params: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string>;
  completeStructured(params: {
    system: string;
    prompt: string;
    tool: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    };
    maxTokens?: number;
  }): Promise<unknown>;
}

export const AI_CLIENT = Symbol('AI_CLIENT');
