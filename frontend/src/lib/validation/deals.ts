import { z } from "zod";
import type { DealTerms } from "@/lib/api/deals";

/** Optional whole-number input coming from an <input>: "" → undefined. */
const optionalInt = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), `${label} must be a whole number`)
    .refine((value) => value === "" || Number(value) <= max, `${label} must be at most ${max.toLocaleString("en-GB")}`)
    .optional();

const optionalDate = z.string().optional();

/**
 * Deal terms, shared by "start deal" and counter-proposals. Mirrors the
 * backend rules: integers ≥ 0, splits 0–100 given together and summing to
 * 100, message ≤ 2000.
 */
export const termsSchema = z
  .object({
    totalValue: optionalInt(100_000_000, "Value"),
    revenueSplitBrand: optionalInt(100, "Brand split"),
    startDate: optionalDate,
    endDate: optionalDate,
    message: z.string().trim().max(2000, "At most 2000 characters").optional(),
  })
  .refine((values) => !values.startDate || !values.endDate || values.startDate <= values.endDate, {
    path: ["endDate"],
    message: "End date must be after the start date",
  });

export type TermsValues = z.infer<typeof termsSchema>;

/** The creator split is derived (100 − brand) so the pair always sums to 100. */
export function toDealTerms(values: TermsValues): DealTerms {
  const brand = values.revenueSplitBrand ? Number(values.revenueSplitBrand) : undefined;
  return {
    totalValue: values.totalValue ? Number(values.totalValue) : undefined,
    revenueSplitBrand: brand,
    revenueSplitCreator: brand === undefined ? undefined : 100 - brand,
    startDate: values.startDate ? new Date(`${values.startDate}T00:00:00.000Z`).toISOString() : undefined,
    endDate: values.endDate ? new Date(`${values.endDate}T00:00:00.000Z`).toISOString() : undefined,
    message: values.message || undefined,
  };
}

export const briefSchema = z
  .object({
    brandId: z.string().min(1, "Choose a brand"),
    title: z.string().trim().min(3, "At least 3 characters").max(120, "At most 120 characters"),
    description: z.string().trim().min(10, "Describe the brief in at least 10 characters").max(5000, "At most 5000 characters"),
    budgetMin: optionalInt(10_000_000, "Minimum budget"),
    budgetMax: optionalInt(10_000_000, "Maximum budget"),
    currency: z.string().length(3),
    deliverables: z.string().max(2000).optional(),
    applicationDeadline: optionalDate,
    location: z.string().trim().max(120, "At most 120 characters").optional(),
    isRemote: z.boolean(),
  })
  .refine(
    (values) => !values.budgetMin || !values.budgetMax || Number(values.budgetMin) <= Number(values.budgetMax),
    { path: ["budgetMax"], message: "Maximum must be at least the minimum" },
  );

export type BriefValues = z.infer<typeof briefSchema>;

/** One deliverable per line; backend allows at most 20. */
export function parseDeliverables(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export const applicationSchema = z.object({
  coverMessage: z
    .string()
    .trim()
    .min(10, "Tell the brand a little more (at least 10 characters)")
    .max(3000, "At most 3000 characters"),
  proposedBudget: optionalInt(10_000_000, "Budget"),
});

export type ApplicationValues = z.infer<typeof applicationSchema>;

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
