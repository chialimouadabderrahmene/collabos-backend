import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env.server";

/**
 * Server-only session handling (BFF).
 *
 * The backend returns access/refresh JWTs in JSON. They are stored exclusively
 * in httpOnly cookies set by Next.js route handlers, so browser JavaScript
 * never sees them. Every backend call from the browser goes through
 * /api/backend/*, which attaches the access token server-side.
 */

import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_FLAG_COOKIE } from "./constants";

const ACCESS_MAX_AGE_S = 15 * 60;
const REFRESH_MAX_AGE_S = 7 * 24 * 60 * 60;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function writeSession(tokens: SessionTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_MAX_AGE_S));
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE_S));
  store.set(SESSION_FLAG_COOKIE, "1", {
    ...cookieOptions(REFRESH_MAX_AGE_S),
    httpOnly: false,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(SESSION_FLAG_COOKIE);
}

export async function readSession(): Promise<Partial<SessionTokens>> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

/* ------------------------------------------------------------ refresh */

interface RefreshResult {
  tokens: SessionTokens;
  at: number;
}

/**
 * The backend rotates refresh tokens (the old one is revoked on use). Several
 * requests that hit 401 at the same time would otherwise race and all but
 * one would fail, logging the user out. Refreshes are therefore single-flight
 * per refresh token, and a successful rotation is reused for a short window.
 * (Per server instance; multi-instance deployments should use sticky
 * sessions or a shared cache — see docs/frontend-backend-gaps.md.)
 */
const inFlight = new Map<string, Promise<SessionTokens | null>>();
const recent = new Map<string, RefreshResult>();
const REUSE_WINDOW_MS = 30_000;

function keyOf(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

export function refreshTokens(refreshToken: string): Promise<SessionTokens | null> {
  const key = keyOf(refreshToken);

  const cached = recent.get(key);
  if (cached && Date.now() - cached.at < REUSE_WINDOW_MS) {
    return Promise.resolve(cached.tokens);
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const attempt = (async () => {
    try {
      const response = await fetch(`${serverEnv.apiUrl}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as SessionTokens;
      const tokens = { accessToken: body.accessToken, refreshToken: body.refreshToken };
      recent.set(key, { tokens, at: Date.now() });
      setTimeout(() => recent.delete(key), REUSE_WINDOW_MS).unref?.();
      return tokens;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, attempt);
  return attempt;
}
