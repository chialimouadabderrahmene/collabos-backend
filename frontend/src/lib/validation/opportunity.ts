import { z } from "zod";

export const COLLABORATION_TYPES = [
  "Capsule collection",
  "Co-branded product",
  "Manufacturing partner",
  "Creative direction",
  "Campaign & content",
  "Retail / pop-up",
] as const;

/** Mirrors backend CreateOpportunityDto limits (title ≤ 160, summary ≤ 2000). */
export const createOpportunitySchema = z.object({
  brandId: z.string().min(1, "Choose a brand"),
  title: z.string().trim().min(1, "Give your Opportunity a title").max(160, "At most 160 characters"),
  summary: z.string().trim().max(2000, "At most 2000 characters").optional(),
  collaborationType: z.string().optional(),
  season: z.string().trim().max(40, "At most 40 characters").optional(),
  /** Optional founder notes, sent to AI "structure" as a suggestion. */
  notes: z.string().trim().max(12000, "At most 12,000 characters").optional(),
});

export type CreateOpportunityValues = z.infer<typeof createOpportunitySchema>;
