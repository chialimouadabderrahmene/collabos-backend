import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/render";
import type { OpportunitySpec } from "./document-model";

vi.mock("@/lib/api/ai", () => ({
  aiApi: { gaps: vi.fn() },
}));

const { aiApi } = await import("@/lib/api/ai");
const { SpecificationSection } = await import("./properties-panel");

/**
 * R1 — the Studio Properties panel's "Specification" section. Tested in
 * isolation from the Tiptap editor (SpecificationSection needs none of it),
 * covering: rendering an existing spec, saving a partial spec through the
 * same on-blur commit pattern the rest of the panel already uses, an empty
 * spec rendering without error, read-only mode, and (R5) the "Questions to
 * clarify" block.
 */
describe("SpecificationSection", () => {
  it("renders every field from an existing spec", () => {
    const spec: OpportunitySpec = {
      intent: "Explore a summer campaign",
      collaborator: { type: "photographer" },
      objective: "Produce a lookbook",
      deliverables: ["10 photos", "3 reels"],
      timeline: "October",
      budget: "€5k",
      constraints: "Milan only",
      successCriteria: "500 signups",
    };

    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={spec} onChange={vi.fn()} canEdit />);

    expect(screen.getByDisplayValue("Explore a summer campaign")).toBeInTheDocument();
    expect(screen.getByDisplayValue("photographer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Produce a lookbook")).toBeInTheDocument();
    // getByDisplayValue normalizes whitespace (collapses newlines) by
    // default, so a multiline textarea value is asserted directly instead.
    expect(screen.getByLabelText("What needs to be produced")).toHaveValue("10 photos\n3 reels");
    expect(screen.getByDisplayValue("October")).toBeInTheDocument();
    expect(screen.getByDisplayValue("€5k")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Milan only")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500 signups")).toBeInTheDocument();
  });

  it("renders an empty spec (an opportunity with none of this set yet) without error", () => {
    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);
    expect(screen.getByLabelText("Why this exists")).toHaveValue("");
  });

  it("commits a single changed field on blur, leaving the rest of the spec untouched", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(
      <SpecificationSection
        opportunityId="opp-1"
        spec={{ intent: "Existing intent", objective: "Existing objective" }}
        onChange={onChange}
        canEdit
      />,
    );

    const objective = screen.getByLabelText("What you're trying to achieve");
    await user.clear(objective);
    await user.type(objective, "New objective");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({
      intent: "Existing intent",
      objective: "New objective",
    });
  });

  it("saves a partial specification — a single field is a valid save", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={onChange} canEdit />);

    const intent = screen.getByLabelText("Why this exists");
    await user.type(intent, "A brand new idea");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ intent: "A brand new idea" });
  });

  it("converts the deliverables textarea (one per line) into a string array", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={onChange} canEdit />);

    const deliverables = screen.getByLabelText("What needs to be produced");
    await user.type(deliverables, "10 photos{enter}3 reels");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ deliverables: ["10 photos", "3 reels"] });
  });

  it("R2: shows a plain 'ready' note for a complete spec, no score or judgment", () => {
    const complete: OpportunitySpec = {
      intent: "x",
      collaborator: { type: "photographer" },
      objective: "x",
      deliverables: ["x"],
      timeline: "x",
      budget: "x",
      constraints: "x",
      successCriteria: "x",
    };
    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={complete} onChange={vi.fn()} canEdit />);
    expect(screen.getByText("Ready for confidence.")).toBeInTheDocument();
    expect(screen.queryByText(/needs a few details/i)).not.toBeInTheDocument();
  });

  it("R2: lists exactly what's missing for an incomplete spec, by the same field labels", () => {
    renderWithClient(
      <SpecificationSection
        opportunityId="opp-1"
        spec={{ intent: "Explore a summer campaign", budget: "€5k" }}
        onChange={vi.fn()}
        canEdit
      />,
    );
    expect(screen.getByText("Needs a few details:")).toBeInTheDocument();
    expect(screen.getByText("Who you're looking for", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("What you're trying to achieve", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("How you'll know it worked", { selector: "li" })).toBeInTheDocument();
    // Already filled in — not listed as missing.
    expect(screen.queryByText("Why this exists", { selector: "li" })).not.toBeInTheDocument();
  });

  it("R2: a legacy Opportunity (empty spec) reads as not yet established, not an error", () => {
    renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);
    expect(screen.getByText("Needs a few details:")).toBeInTheDocument();
  });

  it("disables every field when the user cannot edit", () => {
    renderWithClient(
      <SpecificationSection opportunityId="opp-1" spec={{ intent: "x" }} onChange={vi.fn()} canEdit={false} />,
    );
    expect(screen.getByLabelText("Why this exists")).toBeDisabled();
    expect(screen.getByLabelText("Budget")).toBeDisabled();
  });

  describe("R5: questions to clarify", () => {
    it("is hidden entirely when the user cannot edit", () => {
      renderWithClient(
        <SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit={false} />,
      );
      expect(screen.queryByText("Questions to clarify")).not.toBeInTheDocument();
    });

    it("does nothing until explicitly checked — never an automatic AI call", () => {
      renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);
      expect(screen.getByText("Questions to clarify")).toBeInTheDocument();
      expect(aiApi.gaps).not.toHaveBeenCalled();
    });

    it("shows the returned questions and reasons on click, never a score or recommendation", async () => {
      vi.mocked(aiApi.gaps).mockResolvedValue({
        gaps: [
          {
            key: "objective",
            question: "What outcome should this collaboration achieve?",
            reason: "No objective is currently specified.",
          },
        ],
      });
      const user = userEvent.setup();
      renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);

      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(
        await screen.findByText("What outcome should this collaboration achieve?"),
      ).toBeInTheDocument();
      expect(screen.getByText("No objective is currently specified.")).toBeInTheDocument();
      expect(aiApi.gaps).toHaveBeenCalledWith("opp-1");
    });

    it("shows a subtle empty state when there is nothing to clarify", async () => {
      vi.mocked(aiApi.gaps).mockResolvedValue({ gaps: [] });
      const user = userEvent.setup();
      renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);

      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(await screen.findByText("No open questions.")).toBeInTheDocument();
    });
  });

  describe("Journey continuity", () => {
    it("INSTINCT → SPECIFICITY: explains that the fields below expand the original idea above", () => {
      renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);
      expect(
        screen.getByText("Your original idea — everything below expands it into a full brief."),
      ).toBeInTheDocument();
    });

    it("SPECIFICITY → SUBSTANCE: explains that deliverables describe what the content should include", () => {
      renderWithClient(<SpecificationSection opportunityId="opp-1" spec={{}} onChange={vi.fn()} canEdit />);
      expect(
        screen.getByText("What the content you build on the left should ultimately include."),
      ).toBeInTheDocument();
    });
  });
});
