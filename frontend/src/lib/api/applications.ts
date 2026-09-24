import { http, type Paginated } from "./http";

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

/** A creator's application ("proposal") to a brand brief. */
export interface Application {
  id: string;
  briefId: string;
  applicantId: string;
  status: ApplicationStatus;
  coverMessage: string;
  proposedBudget: number | null;
  decidedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const APPLICATION_MESSAGE = { min: 10, max: 3000 } as const;

type ListQuery = { page?: number; limit?: number; status?: ApplicationStatus };

export const applicationsApi = {
  apply: (input: { briefId: string; coverMessage: string; proposedBudget?: number }) =>
    http.post<Application>("applications", input),
  /** Applications I sent. */
  mine: (query: ListQuery = {}) => http.get<Paginated<Application>>("applications", { ...query }),
  /** Applications to one brief (brand owner only). */
  forBrief: (briefId: string, query: ListQuery = {}) =>
    http.get<Paginated<Application>>(`applications/brief/${briefId}`, { ...query }),
  get: (id: string) => http.get<Application>(`applications/${id}`),
  withdraw: (id: string) => http.post<Application>(`applications/${id}/withdraw`),
  accept: (id: string) => http.post<Application>(`applications/${id}/accept`),
  reject: (id: string) => http.post<Application>(`applications/${id}/reject`),
};
