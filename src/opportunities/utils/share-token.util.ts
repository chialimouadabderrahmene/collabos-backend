import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes → 43 base64url characters (256 bits of entropy). */
const SHARE_TOKEN_BYTES = 32;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_PREFIX_LENGTH = 6;

export interface GeneratedShareToken {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

export function generateShareToken(): GeneratedShareToken {
  const token = randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
  return {
    token,
    tokenHash: hashShareToken(token),
    tokenPrefix: token.slice(0, TOKEN_PREFIX_LENGTH),
  };
}

/** Only this hash is persisted; a database leak does not reveal live links. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cheap shape check so malformed tokens never reach the database. */
export function isWellFormedShareToken(token: string): boolean {
  return SHARE_TOKEN_PATTERN.test(token);
}
