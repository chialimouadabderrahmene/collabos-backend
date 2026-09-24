import "server-only";

import { serverEnv } from "@/lib/env.server";
import {
  clearSession,
  readSession,
  refreshTokens,
  writeSession,
} from "./session";

export interface BackendRequest {
  method: string;
  /** Path below /v1, e.g. `opportunities/123/draft`. */
  path: string;
  search?: string;
  headers?: Headers;
  body?: ArrayBuffer;
}

/** Request headers worth forwarding to the backend. Cookies and the browser's
 * Authorization header are never forwarded. */
const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "idempotency-key",
  "x-request-id",
];

function buildHeaders(source: Headers | undefined, accessToken?: string): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = source?.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

function send(request: BackendRequest, accessToken?: string): Promise<Response> {
  const hasBody = request.body && !["GET", "HEAD"].includes(request.method);
  return fetch(`${serverEnv.apiUrl}/v1/${request.path}${request.search ?? ""}`, {
    method: request.method,
    headers: buildHeaders(request.headers, accessToken),
    body: hasBody ? request.body : undefined,
    cache: "no-store",
    redirect: "manual",
  });
}

/**
 * Calls the backend with the session's access token. If the backend answers
 * 401 (or no access token is present) and a refresh token exists, performs a
 * single-flight token rotation, persists the new cookies and retries once.
 * Must run where cookies are writable (route handlers / server actions).
 */
export async function backendFetch(request: BackendRequest): Promise<Response> {
  const session = await readSession();

  let accessToken = session.accessToken;
  if (!accessToken && session.refreshToken) {
    const rotated = await refreshTokens(session.refreshToken);
    if (rotated) {
      await writeSession(rotated);
      accessToken = rotated.accessToken;
    }
  }

  const response = await send(request, accessToken);
  if (response.status !== 401 || !session.refreshToken) {
    return response;
  }

  const rotated = await refreshTokens(session.refreshToken);
  if (!rotated) {
    await clearSession();
    return response;
  }

  await writeSession(rotated);
  return send(request, rotated.accessToken);
}
