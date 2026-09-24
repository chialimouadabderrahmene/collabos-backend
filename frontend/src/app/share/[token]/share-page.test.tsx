import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShareResult } from "@/lib/api/share.server";

vi.mock("@/lib/api/share.server", () => ({ fetchSharedOpportunity: vi.fn() }));
const { fetchSharedOpportunity } = await import("@/lib/api/share.server");
const { default: SharedOpportunityPage } = await import("./page");

async function renderPage(result: ShareResult) {
  vi.mocked(fetchSharedOpportunity).mockResolvedValue(result);
  const element = await SharedOpportunityPage({ params: Promise.resolve({ token: "t".repeat(43) }) });
  render(element);
}

describe("public share page", () => {
  it("8. renders exactly the pinned published version", async () => {
    await renderPage({
      status: "ok",
      data: {
        title: "AW27 Capsule",
        summary: "Published v2 standfirst",
        metadata: {},
        versionNumber: 2,
        publishedAt: "2026-09-24T10:00:00.000Z",
        format: "tiptap",
        schemaVersion: 1,
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Published copy only." }] }],
        },
        brand: { name: "Void Studio", logoUrl: null },
        assets: [],
        expiresAt: null,
      },
    });
    expect(screen.getByRole("heading", { level: 1, name: "AW27 Capsule" })).toBeInTheDocument();
    expect(screen.getByText("Published copy only.")).toBeInTheDocument();
    expect(screen.getByText("Void Studio")).toBeInTheDocument();
    // No editing surface, no internal identifiers.
    expect(document.querySelector("[contenteditable]")).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/opp-|revision/i);
  });

  it.each([
    ["revoked or expired (backend 404)", { status: "unavailable" } as ShareResult, "This link isn't available"],
    ["rate limited", { status: "rate-limited" } as ShareResult, "Too many requests"],
    ["backend error", { status: "error" } as ShareResult, "Something went wrong"],
  ])("9. fails safely when %s", async (_label, result, text) => {
    await renderPage(result);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
