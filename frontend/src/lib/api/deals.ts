import { http, type Paginated } from "./http";

export type DealStatus = "NEGOTIATING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type DealHealth = "ON_TRACK" | "AT_RISK" | "OVERDUE" | "COMPLETED" | "CANCELLED";

export interface Deal {
  id: string;
  applicationId: string;
  briefId: string;
  brandId: string;
  creatorId: string;
  title: string;
  status: DealStatus;
  health: DealHealth;
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

export const dealsApi = {
  list: (query: { page?: number; limit?: number; status?: DealStatus } = {}) =>
    http.get<Paginated<Deal>>("deals", { ...query }),
  get: (id: string) => http.get<Deal>(`deals/${id}`),
};
