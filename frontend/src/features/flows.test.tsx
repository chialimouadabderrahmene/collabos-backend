import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/http";
import type { Asset, Draft, Opportunity, Version } from "@/lib/api/opportunities";
import { renderWithClient } from "@/test/render";

/* ------------------------------------------------------------ mocks */

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/api/opportunities", () => ({
  opportunitiesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    activity: vi.fn(),
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    versions: vi.fn(),
    version: vi.fn(),
    members: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
    shareLinks: { list: vi.fn(), create: vi.fn(), revoke: vi.fn() },
  },
}));
vi.mock("@/lib/api/brands", () => ({
  brandsApi: { mine: vi.fn(), members: { list: vi.fn() } },
}));
vi.mock("@/lib/api/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/assets")>();
  return { ...actual, assetsApi: { list: vi.fn(), upload: vi.fn(), remove: vi.fn(), updateAltText: vi.fn() } };
});
vi.mock("@/lib/api/ai", () => ({
  aiApi: {
    generate: vi.fn(),
    rewrite: vi.fn(),
    summarize: vi.fn(),
    structure: vi.fn(),
    titles: vi.fn(),
    list: vi.fn(),
    accept: vi.fn(),
    discard: vi.fn(),
  },
}));

const { opportunitiesApi } = await import("@/lib/api/opportunities");
const { brandsApi } = await import("@/lib/api/brands");
const { assetsApi } = await import("@/lib/api/assets");
const { aiApi } = await import("@/lib/api/ai");

/* --------------------------------------------------------- fixtures */

const ASSET = "11111111-1111-4111-8111-111111111111";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    brandId: "brand-1",
    createdById: "u1",
    title: "AW27 Capsule",
    summary: "An atelier collaboration.",
    status: "DRAFT",
    metadata: {},
    latestVersionNumber: 0,
    lastPublishedAt: null,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    capabilities: { view: true, edit: true, publish: true, share: true, manage: true },
    ...overrides,
  };
}

const longText = Array.from({ length: 80 }, () => "atelier").join(" ");
function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    opportunityId: "opp-1",
    format: "tiptap",
    schemaVersion: 1,
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "The concept" }] },
        { type: "paragraph", content: [{ type: "text", text: longText }] },
      ],
    },
    revision: 6,
    updatedById: "u1",
    updatedAt: "2026-09-01T00:00:00.000Z",
    latestVersionNumber: 0,
    hasUnpublishedChanges: true,
    ...overrides,
  };
}

function version(overrides: Partial<Version> = {}): Version {
  return {
    versionNumber: 1,
    title: "AW27 Capsule",
    summary: "An atelier collaboration.",
    contentHash: "a".repeat(64),
    notes: null,
    draftRevision: 6,
    publishedById: "u1",
    publishedAt: "2026-09-24T10:00:00.000Z",
    format: "tiptap",
    schemaVersion: 1,
    content: draft().content,
    metadata: {},
    assets: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(brandsApi.mine).mockResolvedValue([
    {
      id: "brand-1",
      ownerId: "u1",
      name: "Void Studio",
      slug: "void-studio",
      logoUrl: null,
      coverUrl: null,
      isVerified: false,
      verifiedAt: null,
      followersCount: 0,
      isActive: true,
      categories: [],
      profile: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      role: "OWNER",
    },
  ]);
  vi.mocked(assetsApi.list).mockResolvedValue([]);
});

/* ------------------------------------------------------------ tests */

describe("1. user creates an Opportunity", () => {
  it("creates it in the active brand and opens the Studio", async () => {
    const { NewOpportunityForm } = await import("@/features/opportunities/new-opportunity-form");
    vi.mocked(opportunitiesApi.create).mockResolvedValue(opportunity({ id: "opp-new" }));
    const user = userEvent.setup();
    renderWithClient(<NewOpportunityForm />);

    await user.type(await screen.findByLabelText("Title"), "AW27 Capsule");
    await user.click(screen.getByRole("button", { name: /continue to studio/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/opportunities/opp-new/studio"));
    expect(opportunitiesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: "brand-1", title: "AW27 Capsule" }),
    );
    // No notes → the AI structure endpoint is never called.
    expect(aiApi.structure).not.toHaveBeenCalled();
  });

  it("validates the title before calling the API", async () => {
    const { NewOpportunityForm } = await import("@/features/opportunities/new-opportunity-form");
    const user = userEvent.setup();
    renderWithClient(<NewOpportunityForm />);
    await user.click(await screen.findByRole("button", { name: /continue to studio/i }));
    expect(await screen.findByText("Give your Opportunity a title")).toBeInTheDocument();
    expect(opportunitiesApi.create).not.toHaveBeenCalled();
  });
});

describe("4. asset upload", () => {
  it("uploads valid files with progress and rejects invalid ones client-side", async () => {
    const { useAssetUploads } = await import("@/features/assets/hooks");
    const uploaded: Asset = {
      id: ASSET,
      kind: "IMAGE",
      mimeType: "image/png",
      sizeBytes: 10,
      width: 10,
      height: 10,
      altText: null,
      originalFilename: "a.png",
      reference: `asset:${ASSET}`,
      url: "https://signed.example/a",
      urlExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      createdAt: "2026-09-24T00:00:00.000Z",
    };
    vi.mocked(assetsApi.upload).mockImplementation(async (_id, _input, onProgress) => {
      onProgress?.(0.5);
      return uploaded;
    });
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAssetUploads("opp-1"), { wrapper });

    let assets: Asset[] = [];
    await act(async () => {
      assets = await result.current.upload(
        [
          new File(["png"], "a.png", { type: "image/png" }),
          new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
        ],
        "IMAGE",
      );
    });

    expect(assets).toEqual([uploaded]);
    expect(assetsApi.upload).toHaveBeenCalledTimes(1);
    expect(result.current.items.find((item) => item.name === "x.svg")?.status).toBe("error");
    expect(client.getQueryData(["opportunities", "opp-1", "assets"])).toEqual([uploaded]);
  });
});

describe("5. AI suggestions are only applied on explicit acceptance", () => {
  it("shows a preview, applies on click, then records acceptance", async () => {
    const { AiPanel } = await import("@/features/ai/ai-panel");
    vi.mocked(aiApi.list).mockResolvedValue({
      data: [
        {
          id: "sug-1",
          kind: "SUMMARIZE",
          status: "PENDING",
          model: "claude",
          requestedById: "u1",
          createdAt: "2026-09-24T00:00:00.000Z",
          resolvedAt: null,
          output: { summary: "A quiet-luxury knit capsule." },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    vi.mocked(aiApi.accept).mockResolvedValue({} as never);
    const handlers = { insertNodes: vi.fn(), replaceSelection: vi.fn(), applyMeta: vi.fn().mockResolvedValue(undefined) };
    const user = userEvent.setup();
    renderWithClient(<AiPanel opportunityId="opp-1" canEdit handlers={handlers} />);

    expect(await screen.findByText("A quiet-luxury knit capsule.")).toBeInTheDocument();
    // Nothing is applied just by receiving the suggestion.
    expect(handlers.applyMeta).not.toHaveBeenCalled();
    expect(aiApi.accept).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /use as summary/i }));

    await waitFor(() => expect(aiApi.accept).toHaveBeenCalledWith("opp-1", "sug-1"));
    expect(handlers.applyMeta).toHaveBeenCalledWith({ summary: "A quiet-luxury knit capsule." });
  });

  it("explains when AI is not configured (503) and disables requests", async () => {
    const { AiPanel } = await import("@/features/ai/ai-panel");
    vi.mocked(aiApi.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    vi.mocked(aiApi.generate).mockRejectedValue(new ApiError(503, { message: "AI assistance is not configured" }));
    const user = userEvent.setup();
    renderWithClient(
      <AiPanel opportunityId="opp-1" canEdit handlers={{ insertNodes: vi.fn(), replaceSelection: vi.fn(), applyMeta: vi.fn() }} />,
    );

    await user.type(screen.getByLabelText("Your brief"), "Knitwear capsule");
    await user.click(screen.getByRole("button", { name: /generate suggestion/i }));

    expect(await screen.findByText("AI assistance isn't configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate suggestion/i })).toBeDisabled();
  });
});

describe("6. publishing creates a version", () => {
  it("publishes exactly the reviewed revision and only then shows success", async () => {
    const { PublishScreen } = await import("@/features/opportunities/publish-screen");
    vi.mocked(opportunitiesApi.get).mockResolvedValue(opportunity());
    vi.mocked(opportunitiesApi.getDraft).mockResolvedValue(draft({ revision: 6 }));
    let resolvePublish: (value: Version) => void = () => undefined;
    vi.mocked(opportunitiesApi.publish).mockImplementation(
      () => new Promise<Version>((resolve) => (resolvePublish = resolve)),
    );
    const user = userEvent.setup();
    renderWithClient(<PublishScreen opportunityId="opp-1" />);

    await user.click(await screen.findByRole("button", { name: /publish version 1/i }));
    expect(opportunitiesApi.publish).toHaveBeenCalledWith("opp-1", { notes: undefined, expectedDraftRevision: 6 });
    // Not confirmed yet → no success state.
    expect(screen.queryByText(/is live/i)).not.toBeInTheDocument();

    await act(async () => resolvePublish(version({ versionNumber: 1 })));
    expect(await screen.findByText("Version 1 is live")).toBeInTheDocument();
  });

  it("blocks publishing an empty draft", async () => {
    const { PublishScreen } = await import("@/features/opportunities/publish-screen");
    vi.mocked(opportunitiesApi.get).mockResolvedValue(opportunity());
    vi.mocked(opportunitiesApi.getDraft).mockResolvedValue(draft({ format: "blank", content: {} }));
    renderWithClient(<PublishScreen opportunityId="opp-1" />);
    expect(await screen.findByRole("button", { name: /publish version 1/i })).toBeDisabled();
  });

  it("explains a revision conflict at publish time", async () => {
    const { PublishScreen } = await import("@/features/opportunities/publish-screen");
    vi.mocked(opportunitiesApi.get).mockResolvedValue(opportunity());
    vi.mocked(opportunitiesApi.getDraft).mockResolvedValue(draft());
    vi.mocked(opportunitiesApi.publish).mockRejectedValue(
      new ApiError(409, { message: "The draft changed", details: { currentRevision: 7 } }),
    );
    const user = userEvent.setup();
    renderWithClient(<PublishScreen opportunityId="opp-1" />);
    await user.click(await screen.findByRole("button", { name: /publish version 1/i }));
    expect(await screen.findByText(/changed after you reviewed it/i)).toBeInTheDocument();
  });
});

describe("7. a published version displays read-only", () => {
  it("renders the immutable snapshot with no editing controls", async () => {
    const { VersionScreen } = await import("@/features/opportunities/versions-screen");
    vi.mocked(opportunitiesApi.version).mockResolvedValue(version());
    vi.mocked(opportunitiesApi.get).mockResolvedValue(opportunity({ latestVersionNumber: 1 }));
    renderWithClient(<VersionScreen opportunityId="opp-1" versionNumber={1} />);

    expect(await screen.findByRole("heading", { name: "AW27 Capsule" })).toBeInTheDocument();
    expect(screen.getByText("The concept")).toBeInTheDocument();
    expect(screen.getByText(/immutable/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector("[contenteditable=true]")).toBeNull();
  });
});

describe("10. unauthorized users do not see protected data", () => {
  it("shows not-found (no data) when the backend hides the Opportunity", async () => {
    const { OpportunityOverview } = await import("@/features/opportunities/opportunity-overview");
    vi.mocked(opportunitiesApi.get).mockRejectedValue(new ApiError(404, { message: "Opportunity not found" }));
    renderWithClient(<OpportunityOverview opportunityId="someone-elses" />);
    expect(await screen.findByText("Opportunity not found")).toBeInTheDocument();
    expect(opportunitiesApi.versions).not.toHaveBeenCalled();
  });

  it("hides edit/publish/share actions for a viewer (backend still enforces)", async () => {
    const { OpportunityOverview } = await import("@/features/opportunities/opportunity-overview");
    vi.mocked(opportunitiesApi.get).mockResolvedValue(
      opportunity({ latestVersionNumber: 1, capabilities: { view: true, edit: false, publish: false, share: false, manage: false } }),
    );
    vi.mocked(opportunitiesApi.versions).mockResolvedValue([version()]);
    vi.mocked(opportunitiesApi.activity).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    vi.mocked(opportunitiesApi.members.list).mockResolvedValue([]);
    renderWithClient(<OpportunityOverview opportunityId="opp-1" />);

    expect(await screen.findByRole("link", { name: /preview draft/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open studio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^publish$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /share/i })).not.toBeInTheDocument();
    expect(opportunitiesApi.shareLinks.list).not.toHaveBeenCalled();
  });
});
