import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/render";
import type { Decision, VersionSummary } from "@/lib/api/opportunities";

vi.mock("@/lib/api/opportunities", () => ({
  opportunitiesApi: {
    decisions: { list: vi.fn(), create: vi.fn() },
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
const { DecisionSection } = await import("./decision-section");

const version: VersionSummary = {
  versionNumber: 3,
  title: "AW27 Capsule",
  summary: null,
  contentHash: "a".repeat(64),
  notes: null,
  draftRevision: 4,
  publishedById: "owner-1",
  publishedAt: "2026-09-01T00:00:00.000Z",
};

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision-1",
    status: "GO",
    versionNumber: 3,
    rationale: "Strong portfolio match.",
    decidedById: "owner-1",
    decidedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(brandsApi.members.list).mockResolvedValue([]);
  vi.mocked(opportunitiesApi.decisions.list).mockResolvedValue([]);
});

describe("DecisionSection (R3)", () => {
  it("renders: GO/HOLD/NO GO selectable, rationale field, published version shown", async () => {
    renderWithClient(
      <DecisionSection
        opportunityId="opp-1"
        brandId="brand-1"
        metadata={{}}
        latestVersion={version}
        canDecide
      />,
    );

    expect(await screen.findByText("Version 3")).toBeInTheDocument();
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GO" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HOLD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "NO GO" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rationale")).toBeInTheDocument();
  });

  it("no automatic decision: nothing is pre-selected and the record button is disabled until the user acts", async () => {
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );
    await screen.findByText("Version 3");

    expect(screen.getByRole("button", { name: "GO" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "HOLD" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "NO GO" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Record decision" })).toBeDisabled();
  });

  it("requires a rationale before the decision can be recorded — an empty rationale keeps it disabled", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );
    await screen.findByText("Version 3");

    await user.click(screen.getByRole("button", { name: "GO" }));
    expect(screen.getByRole("button", { name: "Record decision" })).toBeDisabled();

    await user.type(screen.getByLabelText("Rationale"), "Strong portfolio match.");
    expect(screen.getByRole("button", { name: "Record decision" })).toBeEnabled();
  });

  it("requires deliberate confirmation before submitting, and sends the selected status", async () => {
    vi.mocked(opportunitiesApi.decisions.create).mockResolvedValue(decision());
    const user = userEvent.setup();
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );
    await screen.findByText("Version 3");

    await user.click(screen.getByRole("button", { name: "HOLD" }));
    await user.type(screen.getByLabelText("Rationale"), "Waiting on budget confirmation.");
    await user.click(screen.getByRole("button", { name: "Record decision" }));

    // Not sent yet — a confirmation dialog must appear first.
    expect(opportunitiesApi.decisions.create).not.toHaveBeenCalled();
    expect(await screen.findByText(/Record HOLD for Version 3/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "HOLD" }));

    await waitFor(() =>
      expect(opportunitiesApi.decisions.create).toHaveBeenCalledWith("opp-1", {
        versionNumber: 3,
        status: "HOLD",
        rationale: "Waiting on budget confirmation.",
      }),
    );
  });

  it("no published version: explains that one is required, and records nothing", async () => {
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={undefined} canDecide />,
    );

    expect(await screen.findByText(/published version is required/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "GO" })).not.toBeInTheDocument();
    expect(opportunitiesApi.decisions.create).not.toHaveBeenCalled();
  });

  it("renders decision history, newest first as returned by the API", async () => {
    vi.mocked(opportunitiesApi.decisions.list).mockResolvedValue([
      decision({ id: "decision-2", status: "HOLD", rationale: "Waiting on budget." }),
      decision({ id: "decision-1", status: "GO", rationale: "Strong portfolio match." }),
    ]);
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );

    expect(await screen.findByText("Waiting on budget.")).toBeInTheDocument();
    expect(screen.getByText("Strong portfolio match.")).toBeInTheDocument();
  });

  it("shows R2 confidence information as context, never as a default selection", async () => {
    renderWithClient(
      <DecisionSection
        opportunityId="opp-1"
        brandId="brand-1"
        metadata={{ spec: { intent: "Explore a summer campaign" } }}
        latestVersion={version}
        canDecide
      />,
    );

    expect(await screen.findByText(/Confidence check/i)).toBeInTheDocument();
    expect(screen.getByText(/detail.*still missing/i)).toBeInTheDocument();
    // Confidence being incomplete never pre-selects a status.
    expect(screen.getByRole("button", { name: "GO" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a distinct error state when the decision history request fails — never the same as zero decisions", async () => {
    vi.mocked(opportunitiesApi.decisions.list).mockRejectedValue(new Error("Not Found"));
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );

    expect(await screen.findByText("Couldn't load decision history")).toBeInTheDocument();
    expect(screen.queryByText("No decisions recorded yet.")).not.toBeInTheDocument();
  });

  it("shows the empty state only for a successful response with zero decisions", async () => {
    vi.mocked(opportunitiesApi.decisions.list).mockResolvedValue([]);
    renderWithClient(
      <DecisionSection opportunityId="opp-1" brandId="brand-1" metadata={{}} latestVersion={version} canDecide />,
    );

    expect(await screen.findByText("No decisions recorded yet.")).toBeInTheDocument();
  });

  it("renders nothing at all when the user cannot decide", () => {
    const { container } = renderWithClient(
      <DecisionSection
        opportunityId="opp-1"
        brandId="brand-1"
        metadata={{}}
        latestVersion={version}
        canDecide={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(opportunitiesApi.decisions.list).not.toHaveBeenCalled();
  });

  describe("Journey continuity: DECISION → VERSION", () => {
    it("the version being decided on links to that exact version's detail page", async () => {
      renderWithClient(
        <DecisionSection
          opportunityId="opp-1"
          brandId="brand-1"
          metadata={{}}
          latestVersion={version}
          canDecide
        />,
      );

      const link = await screen.findByRole("link", { name: "Version 3" });
      expect(link).toHaveAttribute("href", "/opportunities/opp-1/versions/3");
    });

    it("each decision in history links to the exact version it was decided against", async () => {
      vi.mocked(opportunitiesApi.decisions.list).mockResolvedValue([
        decision({ id: "decision-2", versionNumber: 2, status: "HOLD" }),
      ]);
      renderWithClient(
        <DecisionSection
          opportunityId="opp-1"
          brandId="brand-1"
          metadata={{}}
          latestVersion={version}
          canDecide
        />,
      );

      const link = await screen.findByRole("link", { name: "Version 2" });
      expect(link).toHaveAttribute("href", "/opportunities/opp-1/versions/2");
    });
  });
});
