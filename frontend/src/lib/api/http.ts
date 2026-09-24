/**
 * Browser-side HTTP core. Every call goes to this app's same-origin BFF
 * (/api/backend/* → backend /v1/*), which attaches the httpOnly session.
 * UI code never calls fetch directly — it uses the typed modules in lib/api.
 */

export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  error?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
  /** Validation messages (400) when the backend returns a list. */
  readonly messages: string[];

  constructor(status: number, body: ApiErrorBody | null) {
    const messages = Array.isArray(body?.message)
      ? body.message
      : body?.message
        ? [body.message]
        : [];
    super(messages[0] ?? defaultMessage(status));
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code ?? `HTTP_${status}`;
    this.details = body?.details;
    this.requestId = body?.requestId;
    this.messages = messages;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isRateLimited(): boolean {
    return this.status === 429;
  }
  get isUnavailable(): boolean {
    return this.status === 503;
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return "Please check the highlighted fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "This changed since you loaded it.";
    case 413:
      return "That file is too large.";
    case 415:
      return "That file type isn't supported.";
    case 422:
      return "Some information is missing or invalid.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 502:
    case 503:
      return "The service is temporarily unavailable.";
    default:
      return status >= 500 ? "Something went wrong on our side." : "Request failed.";
  }
}

type QueryValue = string | number | boolean | undefined | null;

export function toQuery(params?: Record<string, QueryValue>): string {
  if (!params) {
    return "";
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

const BASE = "/api/backend";

async function request<T>(
  method: string,
  path: string,
  init: { body?: unknown; query?: Record<string, QueryValue>; signal?: AbortSignal } = {},
): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${BASE}/${path}${toQuery(init.query)}`, {
    method,
    credentials: "same-origin",
    headers: init.body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
    body:
      init.body === undefined
        ? undefined
        : isForm
          ? (init.body as FormData)
          : JSON.stringify(init.body),
    signal: init.signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody | null) ?? null);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const http = {
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
