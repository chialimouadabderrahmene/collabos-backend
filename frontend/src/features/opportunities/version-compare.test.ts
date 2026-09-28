import { describe, expect, it } from "vitest";
import type { Version } from "@/lib/api/opportunities";
import { compareVersions } from "./version-compare";

function version(overrides: Partial<Version> = {}): Version {
  return {
    versionNumber: 1,
    title: "Summer Campaign",
    summary: null,
    contentHash: "a".repeat(64),
    notes: null,
    draftRevision: 1,
    publishedById: "u1",
    publishedAt: "2026-09-01T00:00:00.000Z",
    format: "tiptap",
    schemaVersion: 1,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] },
    metadata: {},
    assets: [],
    ...overrides,
  };
}

describe("compareVersions (R6)", () => {
  it("identical versions produce no changes", () => {
    const a = version({ versionNumber: 1 });
    const b = version({ versionNumber: 2 });
    const result = compareVersions(a, b);

    expect(result.hasChanges).toBe(false);
    expect(result.specChanges).toEqual([]);
    expect(result.contentChange).toBeNull();
  });

  it("a single changed spec field is reported with old and new values", () => {
    const a = version({ metadata: { spec: { budget: "€3,000" } } });
    const b = version({ metadata: { spec: { budget: "€5,000" } } });
    const { specChanges } = compareVersions(a, b);

    expect(specChanges).toEqual([
      { key: "budget", label: "Budget", status: "changed", from: "€3,000", to: "€5,000" },
    ]);
  });

  it("a field only present in the newer version is reported as added", () => {
    const a = version({ metadata: { spec: {} } });
    const b = version({ metadata: { spec: { objective: "Produce a lookbook" } } });
    const { specChanges } = compareVersions(a, b);

    expect(specChanges).toEqual([
      { key: "objective", label: "Objective", status: "added", from: null, to: "Produce a lookbook" },
    ]);
  });

  it("a field only present in the older version is reported as removed", () => {
    const a = version({ metadata: { spec: { constraints: "Milan only" } } });
    const b = version({ metadata: { spec: {} } });
    const { specChanges } = compareVersions(a, b);

    expect(specChanges).toEqual([
      { key: "constraints", label: "Constraints", status: "removed", from: "Milan only", to: null },
    ]);
  });

  it("deliverables changes are shown as a readable joined list, not a raw array diff", () => {
    const a = version({ metadata: { spec: { deliverables: ["10 photos"] } } });
    const b = version({ metadata: { spec: { deliverables: ["10 photos", "3 reels"] } } });
    const { specChanges } = compareVersions(a, b);

    expect(specChanges).toEqual([
      {
        key: "deliverables",
        label: "Deliverables",
        status: "changed",
        from: "10 photos",
        to: "10 photos, 3 reels",
      },
    ]);
  });

  it("a lightweight content structure summary changes when word/heading counts differ", () => {
    const a = version({
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "One two three" }] }] },
    });
    const b = version({
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A concept" }] },
          { type: "paragraph", content: [{ type: "text", text: "One two three four five" }] },
        ],
      },
    });
    const { contentChange, hasChanges } = compareVersions(a, b);

    expect(hasChanges).toBe(true);
    expect(contentChange).toEqual({ status: "changed", from: "3 words, 0 headings", to: "7 words, 1 heading" });
  });

  it("never compares binary asset contents — only text already in metadata/content", () => {
    const a = version({
      metadata: { spec: {} },
      assets: [
        {
          id: "1",
          kind: "IMAGE",
          mimeType: "image/png",
          width: 100,
          height: 100,
          altText: "Old shot",
          reference: "asset:1",
          url: "https://x/a",
          urlExpiresAt: "",
        },
      ],
    });
    const b = version({
      metadata: { spec: {} },
      assets: [
        {
          id: "2",
          kind: "IMAGE",
          mimeType: "image/png",
          width: 100,
          height: 100,
          altText: "New shot",
          reference: "asset:2",
          url: "https://x/b",
          urlExpiresAt: "",
        },
      ],
    });
    const result = compareVersions(a, b);

    // Assets are never inspected — only the spec and document text.
    expect(result.hasChanges).toBe(false);
  });

  it("preserves each version's own version number — comparison never renumbers or mutates either snapshot", () => {
    const a = version({ versionNumber: 3, metadata: { spec: { budget: "€1" } } });
    const b = version({ versionNumber: 7, metadata: { spec: { budget: "€2" } } });
    compareVersions(a, b);

    expect(a.versionNumber).toBe(3);
    expect(b.versionNumber).toBe(7);
  });
});
