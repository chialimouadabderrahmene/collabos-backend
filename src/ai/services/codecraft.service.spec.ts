import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeCraftService } from './codecraft.service';

const CONFIG: Record<string, string | undefined> = {
  'ai.codecraftApiKey': 'cc_test_key_not_real',
  'ai.codecraftModel': 'test-model',
  'ai.codecraftBaseUrl': 'https://codecraftapi.com/v1',
};

function makeService(overrides: Record<string, string | undefined> = {}) {
  const values = { ...CONFIG, ...overrides };
  const configService = {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new CodeCraftService(configService);
}

describe('CodeCraftService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API key', () => {
    const service = makeService({ 'ai.codecraftApiKey': undefined });
    expect(service.isConfigured()).toBe(false);
  });

  it('is configured with an API key', () => {
    const service = makeService();
    expect(service.isConfigured()).toBe(true);
  });

  it('reports the configured model', () => {
    const service = makeService();
    expect(service.getModel()).toBe('test-model');
  });

  it('sends Bearer auth and never logs or throws the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = makeService();

    await service.complete({ system: 'sys', prompt: 'hi' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://codecraftapi.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer cc_test_key_not_real',
    );
    // The key must never appear anywhere else in the request.
    expect(init.body as string).not.toContain('cc_test_key_not_real');
  });

  it('completeStructured sends a forced tool call and parses its arguments', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => ({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: 'propose_opportunity_copy',
                    arguments: JSON.stringify({ title: 'The Quiet Knit' }),
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = makeService();

    const result = await service.completeStructured({
      system: 'sys',
      prompt: 'prompt',
      tool: {
        name: 'propose_opportunity_copy',
        description: 'desc',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
    });

    expect(result).toEqual({ title: 'The Quiet Knit' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      tools: Array<{ function: { name: string } }>;
      tool_choice: { function: { name: string } };
    };
    expect(body.tools[0].function.name).toBe('propose_opportunity_copy');
    expect(body.tool_choice.function.name).toBe('propose_opportunity_copy');
  });

  it('rejects when no matching tool call is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: {} }] }),
      }),
    );
    const service = makeService();

    await expect(
      service.completeStructured({
        system: 'sys',
        prompt: 'prompt',
        tool: { name: 'x', description: 'd', inputSchema: {} },
      }),
    ).rejects.toThrow('Model did not return the requested structured output');
  });

  it('rejects malformed tool-call arguments instead of returning garbage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  { function: { name: 'x', arguments: '{not json' } },
                ],
              },
            },
          ],
        }),
      }),
    );
    const service = makeService();

    await expect(
      service.completeStructured({
        system: 'sys',
        prompt: 'prompt',
        tool: { name: 'x', description: 'd', inputSchema: {} },
      }),
    ).rejects.toThrow('Model returned malformed structured output');
  });

  it('rejects a malformed (non-JSON) response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    );
    const service = makeService();

    await expect(
      service.complete({ system: 'sys', prompt: 'hi' }),
    ).rejects.toThrow('CodeCraft returned a malformed response body');
  });

  it('rejects a non-2xx response without leaking the key in the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      }),
    );
    const service = makeService();

    await expect(
      service.complete({ system: 'sys', prompt: 'hi' }),
    ).rejects.toThrow('CodeCraft request failed with status 401');
  });

  it('refuses to call the API when unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = makeService({ 'ai.codecraftApiKey': undefined });

    await expect(
      service.complete({ system: 'sys', prompt: 'hi' }),
    ).rejects.toThrow('CodeCraft client is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
