import { http, type Paginated } from "./http";

export type BriefStatus = "OPEN" | "CLOSED" | "ARCHIVED";

export interface Brief {
  id: string;
  brandId: string;
  title: string;
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  deliverables: string[];
  applicationDeadline: string | null;
  location: string | null;
  isRemote: boolean;
  status: BriefStatus;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListBriefsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: BriefStatus;
  brandId?: string;
  isRemote?: boolean;
}

export interface BriefInput {
  brandId: string;
  title: string;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  deliverables?: string[];
  applicationDeadline?: string;
  location?: string;
  isRemote?: boolean;
}

export const briefsApi = {
  list: (query: ListBriefsQuery = {}) => http.get<Paginated<Brief>>("briefs", { ...query }),
  get: (id: string) => http.get<Brief>(`briefs/${id}`),
  create: (input: BriefInput) => http.post<Brief>("briefs", input),
  close: (id: string) => http.post<Brief>(`briefs/${id}/close`),
  archive: (id: string) => http.post<Brief>(`briefs/${id}/archive`),
};
