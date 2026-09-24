import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

/**
 * Token-issuing auth endpoints. The backend's JSON tokens are moved into
 * httpOnly cookies here and stripped from the response, so the browser only
 * ever receives the user profile.
 *
 * POST /api/auth/login     { email, password }
 * POST /api/auth/register  { email, password }
 * POST /api/auth/logout
 */
type RouteContext = { params: Promise<{ action: string }> };

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

async function forwardCredentials(
  request: NextRequest,
  action: "login" | "register",
): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ statusCode: 400, message: "Invalid JSON body" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${serverEnv.apiUrl}/v1/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { statusCode: 502, code: "BAD_GATEWAY", message: "The CollabOS API is unreachable" },
      { status: 502 },
    );
  }

  const body = (await upstream.json().catch(() => null)) as TokenResponse | null;
  if (!upstream.ok || !body?.accessToken) {
    return NextResponse.json(body ?? { statusCode: upstream.status }, {
      status: upstream.status,
    });
  }

  await writeSession({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return NextResponse.json({ user: body.user }, { status: 200 });
}

async function logout(): Promise<Response> {
  const { refreshToken } = await readSession();
  if (refreshToken) {
    // Best effort: revoke server-side; the local session is cleared regardless.
    await fetch(`${serverEnv.apiUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  await clearSession();
  return new Response(null, { status: 204 });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { action } = await context.params;
  switch (action) {
    case "login":
    case "register":
      return forwardCredentials(request, action);
    case "logout":
      return logout();
    default:
      return NextResponse.json({ statusCode: 404, message: "Not found" }, { status: 404 });
  }
}
