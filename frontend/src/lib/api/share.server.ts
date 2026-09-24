import "server-only";

import { cache } from "react";
import { serverEnv } from "@/lib/env.server";
import type { SharedOpportunity } from "./opportunities";

export type ShareResult =
  | { status: "ok"; data: SharedOpportunity }
  | { status: "unavailable" }
  | { status: "rate-limited" }
  | { status: "error" };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Server-side fetch of a public share link. Unauthenticated by design: the
 * backend returns only the pinned, immutable published version. Deduplicated
 * per request (metadata + page share one call). Never cached across users.
 */
export const fetchSharedOpportunity = cache(async (token: string): Promise<ShareResult> => {
  if (!TOKEN_SHAPE.test(token)) {
    return { status: "unavailable" };
  }
  try {
    const response = await fetch(`${serverEnv.apiUrl}/v1/share/${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      return { status: "ok", data: (await response.json()) as SharedOpportunity };
    }
    if (response.status === 404) {
      return { status: "unavailable" };
    }
    if (response.status === 429) {
      return { status: "rate-limited" };
    }
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
});
