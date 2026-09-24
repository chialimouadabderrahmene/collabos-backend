import { http, type Paginated } from "./http";

/* ------------------------------------------------------------- types */

export type OpportunityStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type OpportunityMemberRole = "EDITOR" | "VIEWER";
export type AssetKind = "IMAGE" | "SKETCH" | "REFERENCE";
export type DocumentFormat = "tiptap" | "prosemirror" | "lexical" | "slate" | "blocks";

export interface Capabilities {
  view: boolean;
  edit: boolean;
  publish: boolean;
  share: boolean;
  manage: boolean;
}

export interface Opportunity {
  id: string;
  brandId: string;
  createdById: string;
  title: string;
  summary: string | null;
  status: OpportunityStatus;
  metadata: Record<string, unknown>;
  latestVersionNumber: number;
  lastPublishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  capabilities?: Capabilities;
}

/** JSON document as produced by the editor (Tiptap JSON). */
export type JsonDocument = Record<string, unknown>;

export interface Draft {
  opportunityId: string;
  /** Editor format, or "blank" for a never-edited draft. */
  format: DocumentFormat | "blank";
  schemaVersion: number;
  content: JsonDocument;
  revision: number;
  updatedById: string | null;
  updatedAt: string;
  latestVersionNumber: number;
  hasUnpublishedChanges: boolean;
}

export interface SaveDraftInput {
  format: DocumentFormat;
  schemaVersion: number;
  content: JsonDocument;
  baseRevision: number;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  originalFilename: string | null;
  /** `asset:<uuid>` — what the document stores. */
  reference: string;
  /** Short-lived signed URL. Never persist it into the document. */
  url: string;
  urlExpiresAt: string;
  createdAt: string;
}

export interface PublishedAsset {
  id: string;
  kind: AssetKind;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  reference: string;
  url: string;
  urlExpiresAt: string;
}

export interface VersionSummary {
  versionNumber: number;
  title: string;
  summary: string | null;
  contentHash: string;
  notes: string | null;
  draftRevision: number;
  publishedById: string;
  publishedAt: string;
}

export interface Version extends VersionSummary {
  format: string;
  schemaVersion: number;
  content: JsonDocument;
  metadata: Record<string, unknown>;
  assets: PublishedAsset[];
}

export type ShareLinkStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface ShareLink {
  id: string;
  tokenPrefix: string;
  versionNumber: number;
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: ShareLinkStatus;
  accessCount: number;
  lastAccessedAt: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreatedShareLink extends ShareLink {
  /** Returned only once, at creation. */
  token: string;
  url: string;
}

export interface SharedOpportunity {
  title: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  versionNumber: number;
  publishedAt: string;
  format: string;
  schemaVersion: number;
  content: JsonDocument;
  brand: { name: string; logoUrl: string | null };
  assets: PublishedAsset[];
  expiresAt: string | null;
}

export type ActivityType =
  | "CREATED"
  | "UPDATED"
  | "ARCHIVED"
  | "ASSET_UPLOADED"
  | "ASSET_DELETED"
  | "PUBLISHED"
  | "SHARE_LINK_CREATED"
  | "SHARE_LINK_REVOKED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "AI_SUGGESTION_REQUESTED";

export interface Activity {
  id: string;
  type: ActivityType;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface OpportunityMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: OpportunityMemberRole;
  createdAt: string;
}

export interface ListOpportunitiesQuery {
  page?: number;
  limit?: number;
  brandId?: string;
  status?: OpportunityStatus;
  search?: string;
}

export interface CreateOpportunityInput {
  brandId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOpportunityInput {
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/* --------------------------------------------------------------- api */

const base = (id: string) => `opportunities/${id}`;

export const opportunitiesApi = {
  list: (query: ListOpportunitiesQuery = {}) =>
    http.get<Paginated<Opportunity>>("opportunities", { ...query }),
  get: (id: string) => http.get<Opportunity>(base(id)),
  create: (input: CreateOpportunityInput) => http.post<Opportunity>("opportunities", input),
  update: (id: string, input: UpdateOpportunityInput) =>
    http.patch<Opportunity>(base(id), input),
  archive: (id: string) => http.delete<Opportunity>(base(id)),
  restore: (id: string) => http.post<Opportunity>(`${base(id)}/restore`),
  activity: (id: string, page = 1) =>
    http.get<Paginated<Activity>>(`${base(id)}/activity`, { page, limit: 20 }),

  getDraft: (id: string) => http.get<Draft>(`${base(id)}/draft`),
  saveDraft: (id: string, input: SaveDraftInput) => http.put<Draft>(`${base(id)}/draft`, input),

  publish: (id: string, input: { notes?: string; expectedDraftRevision?: number } = {}) =>
    http.post<Version>(`${base(id)}/publish`, input),
  versions: (id: string) => http.get<VersionSummary[]>(`${base(id)}/versions`),
  version: (id: string, versionNumber: number) =>
    http.get<Version>(`${base(id)}/versions/${versionNumber}`),

  members: {
    list: (id: string) => http.get<OpportunityMember[]>(`${base(id)}/members`),
    add: (id: string, input: { email: string; role: OpportunityMemberRole }) =>
      http.post<OpportunityMember>(`${base(id)}/members`, input),
    remove: (id: string, userId: string) =>
      http.delete<{ message: string }>(`${base(id)}/members/${userId}`),
  },

  shareLinks: {
    list: (id: string) => http.get<ShareLink[]>(`${base(id)}/share-links`),
    create: (id: string, input: { versionNumber: number; expiresAt?: string; label?: string }) =>
      http.post<CreatedShareLink>(`${base(id)}/share-links`, input),
    revoke: (id: string, linkId: string) =>
      http.delete<{ message: string }>(`${base(id)}/share-links/${linkId}`),
  },
};
