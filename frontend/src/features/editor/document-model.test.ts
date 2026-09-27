import { describe, expect, it } from "vitest";
import { isEmptyOpportunitySpec, readOpportunitySpec } from "./document-model";

describe("readOpportunitySpec — R1", () => {
  it("reads back a complete, valid spec", () => {
    const spec = readOpportunitySpec({
      specVersion: 1,
      spec: {
        intent: "Explore a summer campaign",
        collaborator: { type: "photographer", notes: "Editorial, natural light" },
        objective: "Produce a lookbook",
        deliverables: ["10 photos", "3 reels"],
        timeline: "October",
        budget: "€5k",
        constraints: "Milan only",
        successCriteria: "500 signups",
      },
    });

    expect(spec).toEqual({
      intent: "Explore a summer campaign",
      collaborator: { type: "photographer", notes: "Editorial, natural light" },
      objective: "Produce a lookbook",
      deliverables: ["10 photos", "3 reels"],
      timeline: "October",
      budget: "€5k",
      constraints: "Milan only",
      successCriteria: "500 signups",
    });
  });

  it("reads back a partial spec (one field is enough)", () => {
    expect(readOpportunitySpec({ spec: { intent: "Just an idea" } })).toEqual({
      intent: "Just an idea",
    });
  });

  it("returns an empty object for an opportunity with no metadata at all", () => {
    expect(readOpportunitySpec(undefined)).toEqual({});
    expect(readOpportunitySpec(null)).toEqual({});
  });

  it("returns an empty object for metadata with no spec key (pre-R1 opportunities)", () => {
    expect(readOpportunitySpec({ collaborationType: "Capsule collection", season: "AW27" })).toEqual({});
  });

  it("never throws on a malformed spec — degrades to whatever is readable", () => {
    expect(() => readOpportunitySpec({ spec: "not an object" })).not.toThrow();
    expect(() => readOpportunitySpec({ spec: { intent: 12345 } })).not.toThrow();
    expect(readOpportunitySpec({ spec: { intent: 12345 } })).toEqual({});
  });

  it("filters out non-string deliverables and blank entries", () => {
    expect(readOpportunitySpec({ spec: { deliverables: ["a photo", "", 5, null, "a reel"] } })).toEqual({
      deliverables: ["a photo", "a reel"],
    });
  });

  it("drops an empty collaborator object", () => {
    expect(readOpportunitySpec({ spec: { collaborator: {} } })).toEqual({});
  });
});

describe("isEmptyOpportunitySpec", () => {
  it("is true for an opportunity with no spec at all", () => {
    expect(isEmptyOpportunitySpec(readOpportunitySpec({}))).toBe(true);
  });

  it("is false as soon as a single field is set", () => {
    expect(isEmptyOpportunitySpec(readOpportunitySpec({ spec: { budget: "TBD" } }))).toBe(false);
  });
});
