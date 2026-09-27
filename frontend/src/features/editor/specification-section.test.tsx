import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OpportunitySpec } from "./document-model";
import { SpecificationSection } from "./properties-panel";

/**
 * R1 — the Studio Properties panel's "Specification" section. Tested in
 * isolation from the Tiptap editor (SpecificationSection needs none of it),
 * covering: rendering an existing spec, saving a partial spec through the
 * same on-blur commit pattern the rest of the panel already uses, an empty
 * spec rendering without error, and read-only mode.
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

    render(<SpecificationSection spec={spec} onChange={vi.fn()} canEdit />);

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
    render(<SpecificationSection spec={{}} onChange={vi.fn()} canEdit />);
    expect(screen.getByLabelText("Why this exists")).toHaveValue("");
  });

  it("commits a single changed field on blur, leaving the rest of the spec untouched", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SpecificationSection
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
    render(<SpecificationSection spec={{}} onChange={onChange} canEdit />);

    const intent = screen.getByLabelText("Why this exists");
    await user.type(intent, "A brand new idea");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ intent: "A brand new idea" });
  });

  it("converts the deliverables textarea (one per line) into a string array", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SpecificationSection spec={{}} onChange={onChange} canEdit />);

    const deliverables = screen.getByLabelText("What needs to be produced");
    await user.type(deliverables, "10 photos{enter}3 reels");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ deliverables: ["10 photos", "3 reels"] });
  });

  it("disables every field when the user cannot edit", () => {
    render(<SpecificationSection spec={{ intent: "x" }} onChange={vi.fn()} canEdit={false} />);
    expect(screen.getByLabelText("Why this exists")).toBeDisabled();
    expect(screen.getByLabelText("Budget")).toBeDisabled();
  });
});
