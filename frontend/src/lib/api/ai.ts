import { http, type Paginated } from "./http";

export type AiSuggestionKind = "GENERATE_COPY" | "REWRITE" | "SUMMARIZE" | "STRUCTURE" | "TITLES";
export type AiSuggestionStatus = "PENDING" | "ACCEPTED" | "DISCARDED";

export interface GenerateCopyOutput {
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}
export interface RewriteOutput {
  text: string;
}
export interface SummarizeOutput {
  summary: string;
}
export interface StructureBlock {
  type: "heading" | "paragraph" | "quote" | "list" | "image";
  text?: string;
  level?: number;
  items?: string[];
  caption?: string;
}
export interface StructureOutput {
  title: string;
  summary: string;
  blocks: StructureBlock[];
}
export interface TitlesOutput {
  titles: string[];
  summaries: string[];
}

interface SuggestionBase {
  id: string;
  status: AiSuggestionStatus;
  model: string;
  requestedById: string;
  createdAt: string;
  resolvedAt: string | null;
}

/** Discriminated by `kind`, so the UI renders each output type safely. */
export type AiSuggestion =
  | (SuggestionBase & { kind: "GENERATE_COPY"; output: GenerateCopyOutput })
  | (SuggestionBase & { kind: "REWRITE"; output: RewriteOutput })
  | (SuggestionBase & { kind: "SUMMARIZE"; output: SummarizeOutput })
  | (SuggestionBase & { kind: "STRUCTURE"; output: StructureOutput })
  | (SuggestionBase & { kind: "TITLES"; output: TitlesOutput });

const base = (id: string) => `opportunities/${id}/ai`;

export const aiApi = {
  generate: (id: string, input: { instructions: string; tone?: string }) =>
    http.post<AiSuggestion>(`${base(id)}/generate`, input),
  rewrite: (id: string, input: { text: string; instruction?: string; tone?: string }) =>
    http.post<AiSuggestion>(`${base(id)}/rewrite`, input),
  summarize: (id: string) => http.post<AiSuggestion>(`${base(id)}/summarize`),
  structure: (id: string, input: { notes: string }) =>
    http.post<AiSuggestion>(`${base(id)}/structure`, input),
  titles: (id: string) => http.post<AiSuggestion>(`${base(id)}/titles`),
  list: (id: string, status?: AiSuggestionStatus) =>
    http.get<Paginated<AiSuggestion>>(`${base(id)}/suggestions`, { status, limit: 20 }),
  accept: (id: string, suggestionId: string) =>
    http.post<AiSuggestion>(`${base(id)}/suggestions/${suggestionId}/accept`),
  discard: (id: string, suggestionId: string) =>
    http.post<AiSuggestion>(`${base(id)}/suggestions/${suggestionId}/discard`),
};

/* ---------------------------------------------- collaboration intelligence */

export interface BrandMatch {
  brandId: string;
  creatorId: string;
  /** 0–100 */
  score: number;
  overlapCategories: string[];
  narrative: string;
  generatedByAi: boolean;
  cached: boolean;
}

export interface RevenuePrediction {
  brandId: string;
  trend: "up" | "down" | "flat";
  history: Array<{ period: string; amount: number }>;
  predicted: Array<{ period: string; amount: number }>;
  currency: string;
  narrative: string;
  /** false = heuristic fallback (AI not configured). */
  generatedByAi: boolean;
  cached: boolean;
}

export const insightsApi = {
  brandMatch: (brandId: string) => http.get<BrandMatch>(`ai/brand-match/${brandId}`),
  revenuePrediction: (brandId: string) => http.get<RevenuePrediction>(`ai/revenue-prediction/${brandId}`),
};
