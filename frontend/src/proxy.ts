import { NextResponse, type NextRequest } from "next/server";
import { SESSION_FLAG_COOKIE } from "@/lib/auth/constants";

/**
 * Route gating (UX only). Signed-out visitors are sent to /login and
 * signed-in users skip the auth screens. The backend authorises every API
 * call regardless — this never grants access to data.
 */
const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/share"];
const AUTH_SCREENS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_FLAG_COOKIE)?.value === "1";

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/" || AUTH_SCREENS.includes(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, API route handlers and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
