/** Cookie names shared by route handlers (server-only) and the edge proxy. */
export const ACCESS_COOKIE = "cos_at";
export const REFRESH_COOKIE = "cos_rt";
/** Non-secret presence flag readable by the proxy for route gating only. */
export const SESSION_FLAG_COOKIE = "cos_session";
