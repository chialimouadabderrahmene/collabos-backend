import { describe, expect, it } from 'vitest';
import { selectAiClient } from './ai-provider.factory';
import { AiClient } from './interfaces/ai-client.interface';

const anthropic = { name: 'anthropic' } as unknown as AiClient;
const codecraft = { name: 'codecraft' } as unknown as AiClient;

describe('selectAiClient', () => {
  it('defaults to Anthropic when AI_PROVIDER is unset', () => {
    expect(selectAiClient(undefined, anthropic, codecraft)).toBe(anthropic);
  });

  it('defaults to Anthropic for any value other than "codecraft"', () => {
    expect(selectAiClient('anthropic', anthropic, codecraft)).toBe(anthropic);
    expect(selectAiClient('bogus', anthropic, codecraft)).toBe(anthropic);
  });

  it('selects CodeCraft when AI_PROVIDER=codecraft', () => {
    expect(selectAiClient('codecraft', anthropic, codecraft)).toBe(codecraft);
  });
});
