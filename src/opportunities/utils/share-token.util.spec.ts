import { describe, expect, it } from 'vitest';
import {
  generateShareToken,
  hashShareToken,
  isWellFormedShareToken,
} from './share-token.util';

describe('share tokens', () => {
  it('generates 256-bit url-safe tokens and stores only their hash', () => {
    const { token, tokenHash, tokenPrefix } = generateShareToken();

    expect(isWellFormedShareToken(token)).toBe(true);
    expect(tokenHash).toBe(hashShareToken(token));
    expect(tokenHash).not.toContain(token);
    expect(token.startsWith(tokenPrefix)).toBe(true);
    expect(tokenPrefix).toHaveLength(6);
  });

  it('never repeats', () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateShareToken().token),
    );
    expect(tokens.size).toBe(200);
  });

  it.each([
    '',
    'short',
    '../../etc/passwd',
    'a'.repeat(44),
    `${'a'.repeat(42)}!`,
  ])('rejects malformed token %j', (token) => {
    expect(isWellFormedShareToken(token)).toBe(false);
  });
});
