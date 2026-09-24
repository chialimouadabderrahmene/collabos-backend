import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/backend-fetch", () => ({ backendFetch: vi.fn() }));
const { backendFetch } = await import("@/lib/auth/backend-fetch");
const { GET, POST } = await import("./route");

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe("BFF proxy", () => {
  it.each([["auth", "login"], ["auth", "register"], ["auth", "refresh"], ["auth", "logout"]])(
    "never proxies token-issuing route %s/%s",
    async (...segments) => {
      const response = await POST(new NextRequest(`http://localhost/api/backend/${segments.join("/")}`, { method: "POST", body: "{}" }), ctx(segments));
      expect(response.status).toBe(404);
      expect(backendFetch).not.toHaveBeenCalled();
    },
  );

  it("maps an upstream timeout to 504 and an unreachable upstream to 502", async () => {
    vi.mocked(backendFetch).mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const timedOut = await GET(new NextRequest("http://localhost/api/backend/x"), ctx(["health"]));
    expect(timedOut.status).toBe(504);

    vi.mocked(backendFetch).mockRejectedValueOnce(new TypeError("fetch failed"));
    const unreachable = await GET(new NextRequest("http://localhost/api/backend/x"), ctx(["health"]));
    expect(unreachable.status).toBe(502);
  });

  it("rejects unsafe path segments", async () => {
    const response = await GET(new NextRequest("http://localhost/api/backend/x"), ctx(["..", "health"]));
    expect(response.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("forwards normal calls without leaking set-cookie", async () => {
    vi.mocked(backendFetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": "evil=1", "x-request-id": "req-1" },
      }),
    );
    const response = await GET(
      new NextRequest("http://localhost/api/backend/opportunities?limit=5"),
      ctx(["opportunities"]),
    );
    expect(response.status).toBe(200);
    expect(backendFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "opportunities", search: "?limit=5" }),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-request-id")).toBe("req-1");
  });
});
