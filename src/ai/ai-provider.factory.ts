import { AiClient } from './interfaces/ai-client.interface';

/**
 * Pure provider-selection logic, pulled out of `AiModule`'s DI factory so it
 * can be unit tested without spinning up Nest's injector.
 */
export function selectAiClient(
  provider: string | undefined,
  anthropic: AiClient,
  codecraft: AiClient,
): AiClient {
  return provider === 'codecraft' ? codecraft : anthropic;
}
