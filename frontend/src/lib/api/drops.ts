import { http, type Paginated } from "./http";

export type DropStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type DropVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export interface Drop {
  id: string;
  brandId: string;
  dealId: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: DropStatus;
  visibility: DropVisibility;
  publishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DropPage {
  headline: string | null;
  subheadline: string | null;
  heroImageUrl: string | null;
  /** Plain text / markdown source. Rendered as text, never as HTML. */
  bodyContent: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
}

export interface DropSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  keywords: string[];
}

export interface DropMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  altText: string | null;
  position: number;
}

export interface DropProduct {
  id: string;
  name: string;
  description: string | null;
  /** Whole currency units. */
  price: number;
  currency: string;
  sku: string | null;
  /** null = unlimited. */
  stockQuantity: number | null;
  imageUrl: string | null;
  position: number;
  isAvailable: boolean;
}

export interface DropProductInput {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  sku?: string;
  stockQuantity?: number;
  isAvailable?: boolean;
  position?: number;
}

/** Mirrors backend limits. */
export const DROP_LIMITS = {
  title: { min: 3, max: 120 },
  description: 2000,
  headline: 150,
  subheadline: 250,
  body: 20000,
  ctaLabel: 50,
  url: 500,
  metaTitle: 70,
  metaDescription: 160,
  keywords: 20,
} as const;
export const DROP_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4"];

type ListQuery = { page?: number; limit?: number; search?: string; brandId?: string; status?: DropStatus };

export const dropsApi = {
  list: (query: ListQuery = {}) => http.get<Paginated<Drop>>("drops", { ...query }),
  get: (id: string) => http.get<Drop>(`drops/${id}`),
  create: (input: { brandId: string; dealId?: string; title: string; description?: string }) =>
    http.post<Drop>("drops", input),
  update: (id: string, input: { title?: string; description?: string }) => http.patch<Drop>(`drops/${id}`, input),
  schedule: (id: string, publishAt: string) => http.post<Drop>(`drops/${id}/schedule`, { publishAt }),
  publish: (id: string) => http.post<Drop>(`drops/${id}/publish`),
  archive: (id: string) => http.post<Drop>(`drops/${id}/archive`),
  setVisibility: (id: string, visibility: DropVisibility) =>
    http.patch<Drop>(`drops/${id}/visibility`, { visibility }),

  page: (id: string) => http.get<DropPage>(`drops/${id}/page`),
  updatePage: (id: string, input: Partial<DropPage>) => http.patch<DropPage>(`drops/${id}/page`, input),
  seo: (id: string) => http.get<DropSeo>(`drops/${id}/seo`),
  updateSeo: (id: string, input: Partial<DropSeo>) => http.patch<DropSeo>(`drops/${id}/seo`, input),

  media: (id: string) => http.get<DropMedia[]>(`drops/${id}/media`),
  /** Multipart field name `file` is fixed by the backend. */
  uploadMedia: (id: string, file: File, altText?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (altText) form.append("altText", altText);
    return http.post<DropMedia>(`drops/${id}/media`, form);
  },
  removeMedia: (id: string, mediaId: string) => http.delete<{ message: string }>(`drops/${id}/media/${mediaId}`),

  products: (id: string) => http.get<DropProduct[]>(`drops/${id}/products`),
  addProduct: (id: string, input: DropProductInput) => http.post<DropProduct>(`drops/${id}/products`, input),
  updateProduct: (id: string, productId: string, input: Partial<DropProductInput>) =>
    http.patch<DropProduct>(`drops/${id}/products/${productId}`, input),
  removeProduct: (id: string, productId: string) =>
    http.delete<{ message: string }>(`drops/${id}/products/${productId}`),
};
