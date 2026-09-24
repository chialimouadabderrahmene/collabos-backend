import { describe, expect, it } from "vitest";
import { paragraphs, sectionsToNodes, structureToNodes } from "@/features/ai/convert";
import { precheckFile, refreshIntervalFor } from "@/features/assets/hooks";
import {
  assetIdFromRef,
  collectAssetIds,
  isSafeHref,
  readPresentation,
  DEFAULT_PRESENTATION,
} from "@/features/editor/document-model";
import { canPublishWith, evaluateReadiness } from "@/features/opportunities/readiness";
import { expiryToIso } from "@/features/sharing/share-screen";
import type { Asset, Draft, Opportunity } from "@/lib/api/opportunities";
import { safeNextPath } from "@/lib/validation/auth";

const ASSET = "11111111-1111-4111-8111-111111111111";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    brandId: "b1",
    createdById: "u1",
    title: "AW27 Knitwear",
    summary: "A collaboration with an Italian atelier.",
    status: "DRAFT",
    metadata: {},
    latestVersionNumber: 0,
    lastPublishedAt: null,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function draftWith(content: Record<string, unknown>, format: Draft["format"] = "tiptap"): Draft {
  return {
    opportunityId: "opp-1",
    format,
    schemaVersion: 1,
    content,
    revision: 4,
    updatedById: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    latestVersionNumber: 0,
    hasUnpublishedChanges: true,
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: ASSET,
    kind: "IMAGE",
    mimeType: "image/png",
    sizeBytes: 1000,
    width: 800,
    height: 600,
    altText: "Sketch",
    originalFilename: "sketch.png",
    reference: `asset:${ASSET}`,
    url: "https://signed.example/x",
    urlExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const longText = Array.from({ length: 80 }, () => "word").join(" ");

describe("document model", () => {
  it("extracts asset references wherever they appear, once each", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "assetImage", attrs: { src: `asset:${ASSET}` } },
        { type: "gallery", attrs: { items: [`asset:${ASSET}`, "asset:22222222-2222-4222-8222-222222222222"] } },
      ],
    };
    expect(collectAssetIds(doc)).toEqual([ASSET, "22222222-2222-4222-8222-222222222222"]);
    expect(assetIdFromRef("https://x")).toBeNull();
  });

  it.each([
    ["https://brand.com", true],
    ["mailto:hi@brand.com", true],
    ["#section", true],
    ["javascript:alert(1)", false],
    ["data:text/html,x", false],
    ["//evil.example", false],
  ])("isSafeHref(%s) = %s", (href, expected) => {
    expect(isSafeHref(href)).toBe(expected);
  });

  it("falls back to defaults for unknown presentation values", () => {
    expect(readPresentation({ presentation: { style: "neon", layout: "wide" } })).toEqual({
      ...DEFAULT_PRESENTATION,
      layout: "wide",
    });
  });
});

describe("publish readiness", () => {
  it("blocks an empty draft", () => {
    const checks = evaluateReadiness(opportunity(), draftWith({}, "blank"), []);
    expect(checks.find((check) => check.id === "content")?.status).toBe("fail");
    expect(canPublishWith(checks)).toBe(false);
  });

  it("blocks references to deleted assets", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Concept" }] },
        { type: "paragraph", content: [{ type: "text", text: longText }] },
        { type: "assetImage", attrs: { src: `asset:${ASSET}` } },
      ],
    };
    const checks = evaluateReadiness(opportunity(), draftWith(content), []);
    expect(checks.find((check) => check.id === "assets")?.status).toBe("fail");
  });

  it("passes a complete draft and only warns about missing alt text", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Concept" }] },
        { type: "paragraph", content: [{ type: "text", text: longText }] },
        { type: "assetImage", attrs: { src: `asset:${ASSET}`, alt: "" } },
      ],
    };
    const checks = evaluateReadiness(opportunity(), draftWith(content), [asset({ altText: null })]);
    expect(checks.find((check) => check.id === "alt-text")?.status).toBe("warn");
    expect(canPublishWith(checks)).toBe(true);
  });
});

describe("AI output conversion", () => {
  it("turns generated sections into headings and paragraphs", () => {
    const nodes = sectionsToNodes({
      title: "t",
      summary: "s",
      sections: [{ heading: "The concept", body: "First.\n\nSecond." }],
    });
    expect(nodes.map((node) => node.type)).toEqual(["heading", "paragraph", "paragraph"]);
  });

  it("maps structure blocks and leaves image placeholders for the user", () => {
    const nodes = structureToNodes([
      { type: "heading", text: "Title", level: 1 },
      { type: "list", items: ["a", " ", "b"] },
      { type: "quote", text: "Quiet luxury" },
      { type: "image", caption: "Hero look" },
    ]);
    expect(nodes.map((node) => node.type)).toEqual(["heading", "bulletList", "blockquote", "paragraph"]);
    expect(nodes[1].content).toHaveLength(2);
    expect(JSON.stringify(nodes[3])).toContain("[Image: Hero look]");
  });

  it("drops empty paragraphs", () => {
    expect(paragraphs("  \n\n  ")).toEqual([]);
  });
});

describe("assets", () => {
  it("prechecks size and type (backend remains authoritative)", () => {
    const big = new File([new Uint8Array(16 * 1024 * 1024)], "big.png", { type: "image/png" });
    expect(precheckFile(big, "IMAGE")).toMatch(/15 MB/);
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    expect(precheckFile(svg, "IMAGE")).toMatch(/JPEG/);
    const pdf = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });
    expect(precheckFile(pdf, "IMAGE")).toMatch(/references/);
    expect(precheckFile(pdf, "REFERENCE")).toBeNull();
  });

  it("refreshes signed URLs a minute before the earliest expiry", () => {
    const now = Date.now();
    const soon = asset({ urlExpiresAt: new Date(now + 5 * 60_000).toISOString() });
    const later = asset({ urlExpiresAt: new Date(now + 15 * 60_000).toISOString() });
    expect(refreshIntervalFor([later, soon], now)).toBe(4 * 60_000);
    expect(refreshIntervalFor([], now)).toBe(false);
  });
});

describe("sharing & auth helpers", () => {
  it("computes share-link expiry", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    expect(expiryToIso("never", "", now)).toBeUndefined();
    expect(expiryToIso("7", "", now)).toBe("2026-10-01T12:00:00.000Z");
    expect(expiryToIso("custom", "", now)).toBeUndefined();
  });

  it.each([
    ["/opportunities/1", "/opportunities/1"],
    ["https://evil.example", "/home"],
    ["//evil.example", "/home"],
    ["/\\evil.example", "/home"],
    [null, "/home"],
  ])("safeNextPath(%s) → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
