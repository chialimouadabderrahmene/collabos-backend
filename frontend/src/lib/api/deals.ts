import { http, type Paginated } from "./http";

export type DealStatus = "NEGOTIATING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type DealHealth = "ON_TRACK" | "AT_RISK" | "OVERDUE" | "COMPLETED" | "CANCELLED";
export type DealParty = "BRAND" | "CREATOR";
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";

export interface Deal {
  id: string;
  applicationId: string;
  briefId: string;
  brandId: string;
  creatorId: string;
  title: string;
  status: DealStatus;
  health: DealHealth;
  /** Whole currency units (the backend stores integers). */
  totalValue: number | null;
  currency: string;
  revenueSplitBrand: number | null;
  revenueSplitCreator: number | null;
  startDate: string | null;
  endDate: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealTerms {
  totalValue?: number;
  revenueSplitBrand?: number;
  revenueSplitCreator?: number;
  startDate?: string;
  endDate?: string;
  message?: string;
}

export interface Proposal {
  id: string;
  dealId: string;
  proposedById: string;
  status: ProposalStatus;
  totalValue: number | null;
  revenueSplitBrand: number | null;
  revenueSplitCreator: number | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface Responsibility {
  id: string;
  party: DealParty;
  description: string;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export const dealsApi = {
  list: (query: { page?: number; limit?: number; status?: DealStatus } = {}) =>
    http.get<Paginated<Deal>>("deals", { ...query }),
  get: (id: string) => http.get<Deal>(`deals/${id}`),
  create: (input: DealTerms & { applicationId: string; title?: string; currency?: string }) =>
    http.post<Deal>("deals", input),
  complete: (id: string) => http.post<Deal>(`deals/${id}/complete`),
  cancel: (id: string, reason?: string) => http.post<Deal>(`deals/${id}/cancel`, { reason }),

  proposals: {
    list: (dealId: string) => http.get<Proposal[]>(`deals/${dealId}/proposals`),
    create: (dealId: string, input: DealTerms) => http.post<Proposal>(`deals/${dealId}/proposals`, input),
    accept: (dealId: string, proposalId: string) =>
      http.post<Proposal>(`deals/${dealId}/proposals/${proposalId}/accept`),
    reject: (dealId: string, proposalId: string) =>
      http.post<Proposal>(`deals/${dealId}/proposals/${proposalId}/reject`),
  },
  responsibilities: {
    list: (dealId: string) => http.get<Responsibility[]>(`deals/${dealId}/responsibilities`),
    create: (dealId: string, input: { party: DealParty; description: string; dueDate?: string }) =>
      http.post<Responsibility>(`deals/${dealId}/responsibilities`, input),
    complete: (dealId: string, id: string) =>
      http.post<Responsibility>(`deals/${dealId}/responsibilities/${id}/complete`),
    remove: (dealId: string, id: string) =>
      http.delete<{ message: string }>(`deals/${dealId}/responsibilities/${id}`),
  },
  milestones: {
    list: (dealId: string) => http.get<Milestone[]>(`deals/${dealId}/milestones`),
    create: (dealId: string, input: { title: string; dueDate?: string; position?: number }) =>
      http.post<Milestone>(`deals/${dealId}/milestones`, input),
    complete: (dealId: string, id: string) => http.post<Milestone>(`deals/${dealId}/milestones/${id}/complete`),
    remove: (dealId: string, id: string) => http.delete<{ message: string }>(`deals/${dealId}/milestones/${id}`),
  },
};
