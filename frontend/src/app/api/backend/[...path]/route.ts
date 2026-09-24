import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "@/lib/auth/backend-fetch";

/**
 * Same-origin proxy from the browser to the backend (`/api/backend/<path>` →
 * `${API_URL}/v1/<path>`), attaching the httpOnly session token server-side.
 *
 * Token-issuing auth routes are refused here: they are served only by the
 * dedicated /api/auth/* handlers, which move tokens into httpOnly cookies, so
 * a token can never be returned to browser JavaScript through this proxy.
 */
const BLOCKED_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/refresh",
  "auth/logout",
]);

const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

/** Allowed characters only, and never a dot-segment (`.` / `..`) that could escape `/v1`. */
function isSafeSegment(segment: string): boolean {
  return SAFE_SEGMENT.test(segment) && segment !== "." && segment !== "..";
}

/** Response headers passed back to the browser. `set-cookie` never is. */
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "x-request-id",
  "retry-after",
];

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;

  if (path.length === 0 || !path.every(isSafeSegment)) {
    return NextResponse.json({ statusCode: 400, message: "Invalid path" }, { status: 400 });
  }

  const joined = path.join("/");
  if (BLOCKED_PATHS.has(joined)) {
    return NextResponse.json({ statusCode: 404, message: "Not found" }, { status: 404 });
  }

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await backendFetch({
      method: request.method,
      path: joined,
      search: request.nextUrl.search,
      headers: request.headers,
      body,
    });
  } catch {
    return NextResponse.json(
      { statusCode: 502, code: "BAD_GATEWAY", message: "The CollabOS API is unreachable" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
