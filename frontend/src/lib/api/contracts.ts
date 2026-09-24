import type { DealParty } from "./deals";
import { http, type Paginated } from "./http";

export type ContractStatus = "DRAFT" | "AWAITING_SIGNATURE" | "PARTIALLY_SIGNED" | "EXECUTED" | "VOIDED";
export type ContractEventType =
  | "CREATED"
  | "VERSION_CREATED"
  | "SENT_FOR_SIGNATURE"
  | "SIGNED"
  | "FULLY_EXECUTED"
  | "VOIDED";

export interface Contract {
  id: string;
  dealId: string;
  brandId: string;
  creatorId: string;
  status: ContractStatus;
  currentVersionNumber: number;
  executedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Signature {
  id: string;
  party: DealParty;
  signerId: string;
  signedName: string;
  signedAt: string;
}

export interface ContractVersion {
  id: string;
  versionNumber: number;
  /** Plain-text terms. Rendered as text, never as HTML. */
  content: string;
  pdfAvailable: boolean;
  createdById: string;
  createdAt: string;
  signatures: Signature[];
}

export interface ContractEvent {
  id: string;
  type: ContractEventType;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const CONTRACT_CONTENT = { min: 20, max: 20000 } as const;

export const contractsApi = {
  list: (query: { page?: number; limit?: number; status?: ContractStatus } = {}) =>
    http.get<Paginated<Contract>>("contracts", { ...query }),
  get: (id: string) => http.get<Contract>(`contracts/${id}`),
  create: (input: { dealId: string; content: string }) => http.post<Contract>("contracts", input),
  versions: (id: string) => http.get<ContractVersion[]>(`contracts/${id}/versions`),
  addVersion: (id: string, content: string) => http.post<Contract>(`contracts/${id}/versions`, { content }),
  send: (id: string) => http.post<Contract>(`contracts/${id}/send`),
  void: (id: string, reason?: string) => http.post<Contract>(`contracts/${id}/void`, { reason }),
  sign: (id: string, signedName: string) => http.post<Signature>(`contracts/${id}/sign`, { signedName }),
  signatures: (id: string) => http.get<Signature[]>(`contracts/${id}/signatures`),
  history: (id: string) => http.get<ContractEvent[]>(`contracts/${id}/history`),
  /** Same-origin, cookie-authenticated download through the BFF proxy. */
  pdfUrl: (id: string, versionNumber: number) => `/api/backend/contracts/${id}/versions/${versionNumber}/pdf`,
};
