import { describe, expect, it } from "vitest";
import { assignableRoles, canManageMember } from "@/features/brands/team-screen";
import { partyOf } from "@/features/deals/status";
import { isStripeUrl } from "@/features/payouts/payouts-screen";
import type { BrandMember } from "@/lib/api/brands";
import { formatAmount } from "@/lib/utils/format";
import { safeHref } from "@/lib/utils/safe-url";
import {
  applicationSchema,
  briefSchema,
  parseDeliverables,
  termsSchema,
  toDealTerms,
} from "@/lib/validation/deals";

const member = (overrides: Partial<BrandMember> = {}): BrandMember => ({
  userId: "u2",
  email: "a@b.co",
  displayName: null,
  role: "EDITOR",
  isBrandOwner: false,
  createdAt: "2026-09-24T00:00:00.000Z",
  ...overrides,
});

describe("brand role rules (mirror backend; UX only)", () => {
  it("lets owners grant any role and admins only editor/viewer", () => {
    expect(assignableRoles("OWNER")).toEqual(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
    expect(assignableRoles("ADMIN")).toEqual(["EDITOR", "VIEWER"]);
    expect(assignableRoles("EDITOR")).toEqual([]);
    expect(assignableRoles(undefined)).toEqual([]);
  });

  it("never lets anyone manage the legal owner, and admins not other admins", () => {
    expect(canManageMember("OWNER", member({ role: "OWNER", isBrandOwner: true }))).toBe(false);
    expect(canManageMember("ADMIN", member({ role: "ADMIN" }))).toBe(false);
    expect(canManageMember("ADMIN", member({ role: "VIEWER" }))).toBe(true);
    expect(canManageMember("VIEWER", member())).toBe(false);
  });
});

describe("deal terms", () => {
  it("derives the creator split so the pair always sums to 100", () => {
    const terms = toDealTerms({ totalValue: "14000", revenueSplitBrand: "60", startDate: "2026-10-01", endDate: "", message: "" });
    expect(terms).toEqual({
      totalValue: 14000,
      revenueSplitBrand: 60,
      revenueSplitCreator: 40,
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: undefined,
      message: undefined,
    });
  });

  it("omits both splits when none is given (backend requires them together)", () => {
    const terms = toDealTerms({ totalValue: "", revenueSplitBrand: "", startDate: "", endDate: "", message: "" });
    expect(terms.revenueSplitBrand).toBeUndefined();
    expect(terms.revenueSplitCreator).toBeUndefined();
  });

  it("rejects fractional values, splits above 100 and inverted dates", () => {
    expect(termsSchema.safeParse({ totalValue: "12.5" }).success).toBe(false);
    expect(termsSchema.safeParse({ revenueSplitBrand: "101" }).success).toBe(false);
    const inverted = termsSchema.safeParse({ startDate: "2027-01-01", endDate: "2026-01-01" });
    expect(inverted.success).toBe(false);
    expect(inverted.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("identifies the viewer's side of a deal", () => {
    expect(partyOf({ creatorId: "u1" }, "u1")).toBe("CREATOR");
    expect(partyOf({ creatorId: "u1" }, "u2")).toBe("BRAND");
  });
});

describe("briefs and proposals validation", () => {
  const valid = {
    brandId: "b1",
    title: "Knitwear atelier",
    description: "Looking for an Italian atelier.",
    budgetMin: "10000",
    budgetMax: "18000",
    currency: "EUR",
    isRemote: true,
  };

  it("accepts a valid brief and rejects min > max", () => {
    expect(briefSchema.safeParse(valid).success).toBe(true);
    const inverted = briefSchema.safeParse({ ...valid, budgetMin: "20000" });
    expect(inverted.success).toBe(false);
    expect(inverted.error?.issues[0].path).toEqual(["budgetMax"]);
  });

  it("parses deliverables one per line, trimmed and capped at 20", () => {
    expect(parseDeliverables(" Tech pack \n\nSampling\n")).toEqual(["Tech pack", "Sampling"]);
    expect(parseDeliverables(Array.from({ length: 25 }, (_, i) => `D${i}`).join("\n"))).toHaveLength(20);
  });

  it("enforces the backend cover message length", () => {
    expect(applicationSchema.safeParse({ coverMessage: "too short" }).success).toBe(false);
    expect(applicationSchema.safeParse({ coverMessage: "We knit recycled cashmere." }).success).toBe(true);
  });
});

describe("URL safety", () => {
  it("only renders absolute http(s) CTA links", () => {
    expect(safeHref("https://voidstudio.com/aw27")).toBe("https://voidstudio.com/aw27");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });

  it("only follows Stripe onboarding links on https stripe.com hosts", () => {
    expect(isStripeUrl("https://connect.stripe.com/setup/e/acct_1/abc")).toBe(true);
    expect(isStripeUrl("http://connect.stripe.com/x")).toBe(false);
    expect(isStripeUrl("https://stripe.com.evil.test/x")).toBe(false);
    expect(isStripeUrl("https://evilstripe.com/x")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats currency-less amounts without inventing a symbol", () => {
    expect(formatAmount(14200)).toBe("14,200");
  });
});
