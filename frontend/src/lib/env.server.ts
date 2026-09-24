import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. `API_URL` is deliberately NOT a NEXT_PUBLIC_
 * variable: the browser never talks to the backend directly, only to this
 * app's /api/* route handlers.
 */
const schema = z.object({
  API_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.parse({
  API_URL: process.env.API_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.API_URL && parsed.NODE_ENV === "production") {
  throw new Error("API_URL is required in production (e.g. https://api.neao.online).");
}

export const serverEnv = {
  // The localhost fallback is a development convenience only; production
  // must set API_URL explicitly (enforced below).
  apiUrl: (parsed.API_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  isProduction: parsed.NODE_ENV === "production",
} as const;
