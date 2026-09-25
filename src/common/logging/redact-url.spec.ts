import { describe, expect, it } from 'vitest';
import { redactUrl } from './redact-url';

describe('redactUrl', () => {
  it('redacts share tokens in the path', () => {
    expect(redactUrl('/v1/share/AbCdEf_-123?x=1')).toBe(
      '/v1/share/[redacted]?x=1',
    );
  });

  it('redacts signatures and tokens in the query string', () => {
    expect(
      redactUrl('/storage/opportunities/a/b.png?expires=1&signature=deadbeef'),
    ).toBe('/storage/opportunities/a/b.png?expires=1&signature=[redacted]');
    expect(redactUrl('/x?token=abc&y=2')).toBe('/x?token=[redacted]&y=2');
  });

  it('leaves ordinary URLs untouched', () => {
    expect(redactUrl('/v1/opportunities/123/share-links')).toBe(
      '/v1/opportunities/123/share-links',
    );
  });
});
