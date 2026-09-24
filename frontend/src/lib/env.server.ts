import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. `API_URL` is deliberately NOT a NEXT_PUBLIC_
 * variable: the browser never talks to the backend directly, only to this
 * app's /api/* route handlers.
 */
const schema = z.object({
  API_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.parse({
  API_URL: process.env.API_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const serverEnv = {
  apiUrl: parsed.API_URL.replace(/\/+$/, ""),
  isProduction: parsed.NODE_ENV === "production",
} as const;
