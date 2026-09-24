import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/http";
import { renderWithClient } from "@/test/render";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=/opportunities/opp-1"),
}));
vi.mock("@/lib/api/auth", () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));
const { authApi } = await import("@/lib/api/auth");

describe("LoginForm", () => {
  it("signs in and returns to the requested page", async () => {
    const { LoginForm } = await import("./login-form");
    vi.mocked(authApi.login).mockResolvedValue({ id: "u1", email: "a@b.co", isEmailVerified: true, roles: [], permissions: [] });
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "founder@voidstudio.com");
    await user.type(screen.getByLabelText("Password"), "Void-Studio-2026!");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/opportunities/opp-1"));
  });

  it("shows a clear message for wrong credentials", async () => {
    const { LoginForm } = await import("./login-form");
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, { message: "Invalid credentials" }));
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "founder@voidstudio.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});

describe("RegisterForm", () => {
  it("enforces the backend password policy before submitting", async () => {
    const { RegisterForm } = await import("./register-form");
    const user = userEvent.setup();
    renderWithClient(<RegisterForm />);
    await user.type(screen.getByLabelText("Email"), "founder@voidstudio.com");
    await user.type(screen.getByLabelText("Password"), "weakpass");
    await user.type(screen.getByLabelText("Confirm password"), "weakpass");
    await user.click(screen.getByRole("button", { name: "Get Started" }));
    expect(await screen.findByText("Add an uppercase letter")).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });
});

describe("route protection (proxy)", () => {
  it("redirects signed-out visitors to /login with a return path", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3001/opportunities/opp-1/studio"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/login?next=%2Fopportunities%2Fopp-1%2Fstudio",
    );
  });

  it("keeps share pages public", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(new NextRequest("http://localhost:3001/share/abc"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends signed-in users from auth screens to Home", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3001/login", {
      headers: { cookie: "cos_session=1" },
    });
    expect(proxy(request).headers.get("location")).toBe("http://localhost:3001/home");
  });
});
