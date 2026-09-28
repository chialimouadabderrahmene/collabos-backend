import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/render";
import type { Opportunity, Version, VersionSummary } from "@/lib/api/opportunities";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

vi.mock("@/lib/api/opportunities", () => ({
  opportunitiesApi: {
    get: vi.fn(),
    versions: vi.fn(),
    version: vi.fn(),
  },
}));
vi.mock("@/lib/api/brands", () => ({
  brandsApi: { members: { list: vi.fn() } },
}));
vi.mock("@/features/auth/hooks", () => ({
  useSession: () => ({ data: { id: "owner-1" } }),
}));

const { opportunitiesApi } = await import("@/lib/api/opportunities");
const { brandsApi } = await import("@/lib/api/brands");
const { VersionsScreen } = await import("./versions-screen");

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    brandId: "brand-1",
    createdById: "owner-1",
    title: "Summer Campaign with a Fashion Brand",
    summary: null,
    status: "PUBLISHED",
    metadata: {},
    latestVersionNumber: 2,
    lastPublishedAt: "2026-09-02T00:00:00.000Z",
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    capabilities: { view: true, edit: true, publish: true, share: true, manage: true },
    ...overrides,
  };
}

function summary(overrides: Partial<VersionSummary> = {}): VersionSummary {
  return {
    versionNumber: 1,
    title: "Summer Campaign",
    summary: null,
    contentHash: "a".repeat(64),
    notes: null,
    draftRevision: 1,
    publishedById: "owner-1",
    publishedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function fullVersion(overrides: Partial<Version> = {}): Version {
  return {
    ...summary(),
    format: "tiptap",
    schemaVersion: 1,
    content: { type: "doc", content: [] },
    metadata: {},
    assets: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(opportunitiesApi.get).mockResolvedValue(opportunity());
  vi.mocked(brandsApi.members.list).mockResolvedValue([]);
});

describe("VersionsScreen — R6 compare", () => {
  it("does not show a compare section when only one version exists", async () => {
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([summary({ versionNumber: 1 })]);
    renderWithClient(<VersionsScreen opportunityId="opp-1" />);

    await screen.findByText("Summer Campaign");
    expect(screen.queryByText("Compare versions")).not.toBeInTheDocument();
  });

  it("traceability: the version selectors only ever offer versions belonging to this Opportunity", async () => {
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([
      summary({ versionNumber: 2, title: "v2 title" }),
      summary({ versionNumber: 1, title: "v1 title" }),
    ]);
    vi.mocked(opportunitiesApi.version).mockResolvedValue(fullVersion({ versionNumber: 1 }));
    renderWithClient(<VersionsScreen opportunityId="opp-1" />);

    await screen.findByText("Compare versions");
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    // Every offered option comes from this opportunity's own version list —
    // there is no way to select a version of a different Opportunity.
    expect(options.filter((text) => text?.includes("v2 title")).length).toBeGreaterThan(0);
    expect(options.filter((text) => text?.includes("v1 title")).length).toBeGreaterThan(0);
    expect(options.every((text) => text?.includes("v1 title") || text?.includes("v2 title"))).toBe(true);
  });

  it("shows 'No changes.' when the two selected versions are identical", async () => {
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([
      summary({ versionNumber: 2 }),
      summary({ versionNumber: 1 }),
    ]);
    vi.mocked(opportunitiesApi.version).mockImplementation((_id, n) =>
      Promise.resolve(fullVersion({ versionNumber: n })),
    );
    renderWithClient(<VersionsScreen opportunityId="opp-1" />);

    await waitFor(() => expect(screen.getByText("No changes.")).toBeInTheDocument());
  });

  it("shows field-level changes between two different published versions", async () => {
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([
      summary({ versionNumber: 2 }),
      summary({ versionNumber: 1 }),
    ]);
    vi.mocked(opportunitiesApi.version).mockImplementation((_id, n) =>
      Promise.resolve(
        fullVersion({
          versionNumber: n,
          metadata: { spec: { budget: n === 1 ? "€3,000" : "€5,000" } },
        }),
      ),
    );
    renderWithClient(<VersionsScreen opportunityId="opp-1" />);

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(await screen.findByText(/€3,000.*€5,000/)).toBeInTheDocument();
  });

  it("switching Version A re-fetches and re-renders the comparison, version numbers stay visible", async () => {
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([
      summary({ versionNumber: 3 }),
      summary({ versionNumber: 2 }),
      summary({ versionNumber: 1 }),
    ]);
    vi.mocked(opportunitiesApi.version).mockImplementation((_id, n) =>
      Promise.resolve(fullVersion({ versionNumber: n })),
    );
    const user = userEvent.setup();
    renderWithClient(<VersionsScreen opportunityId="opp-1" />);

    await screen.findByText("Compare versions");
    const [selectA] = screen.getAllByRole("combobox");
    await user.selectOptions(selectA, "1");

    await waitFor(() =>
      expect(opportunitiesApi.version).toHaveBeenCalledWith("opp-1", 1),
    );
    // The version list itself (v3/v2/v1 badges) is untouched by the compare
    // section — nothing else on the page was removed or renumbered.
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
});
