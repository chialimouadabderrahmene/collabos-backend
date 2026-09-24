import { ApiError, type ApiErrorBody, http } from "./http";

export interface SessionUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  roles: string[];
  permissions: string[];
}

export interface Credentials {
  email: string;
  password: string;
}

/** Credential calls go to the dedicated /api/auth/* handlers (never the
 * generic proxy), which store the tokens in httpOnly cookies. */
async function credentials(action: "login" | "register", body: Credentials): Promise<SessionUser> {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | { user: SessionUser }
    | ApiErrorBody
    | null;
  if (!response.ok || !data || !("user" in data)) {
    throw new ApiError(response.status, (data as ApiErrorBody | null) ?? null);
  }
  return data.user;
}

export const authApi = {
  login: (body: Credentials) => credentials("login", body),
  register: (body: Credentials) => credentials("register", body),
  logout: async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  },
  me: () => http.get<SessionUser>("auth/me"),
  forgotPassword: (email: string) =>
    http.post<{ message: string }>("auth/forgot-password", { email }),
  /** Tokens come from emailed links; they are sent once and never stored. */
  resetPassword: (token: string, newPassword: string) =>
    http.post<{ message: string }>("auth/reset-password", { token, newPassword }),
  verifyEmail: (token: string) => http.post<{ message: string }>("auth/verify-email", { token }),
};
