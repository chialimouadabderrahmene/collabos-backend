import { http, type Paginated } from "./http";

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  /** Whole currency units. */
  price: number;
  compareAtPrice: number | null;
  currency: string;
  isActive: boolean;
  categories: ProductCategory[];
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  priceOverride: number | null;
  effectivePrice: number;
  stockQuantity: number;
  isActive: boolean;
}

export interface ProductMedia {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

export type StockMovementType = "RESTOCK" | "SALE" | "ADJUSTMENT" | "RETURN";

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface ProductInput {
  brandId: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  currency?: string;
}

export interface VariantInput {
  sku: string;
  size?: string;
  color?: string;
  priceOverride?: number;
  stockQuantity?: number;
}

export const PRODUCT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: string;
  category?: string;
  includeInactive?: boolean;
};

export const productsApi = {
  list: (query: ListQuery = {}) => http.get<Paginated<Product>>("products", { ...query }),
  get: (id: string) => http.get<Product>(`products/${id}`),
  create: (input: ProductInput) => http.post<Product>("products", input),
  update: (id: string, input: Partial<Omit<ProductInput, "brandId">>) => http.patch<Product>(`products/${id}`, input),
  /** Soft-deactivates the product (backend DELETE). */
  deactivate: (id: string) => http.delete<{ message: string }>(`products/${id}`),

  variants: (id: string) => http.get<Variant[]>(`products/${id}/variants`),
  addVariant: (id: string, input: VariantInput) => http.post<Variant>(`products/${id}/variants`, input),
  updateVariant: (id: string, variantId: string, input: Partial<VariantInput>) =>
    http.patch<Variant>(`products/${id}/variants/${variantId}`, input),
  removeVariant: (id: string, variantId: string) =>
    http.delete<{ message: string }>(`products/${id}/variants/${variantId}`),
  adjustStock: (
    id: string,
    variantId: string,
    input: { type: StockMovementType; quantity: number; reason?: string },
  ) => http.post<Variant>(`products/${id}/variants/${variantId}/stock`, input),
  stockMovements: (id: string, variantId: string, page = 1) =>
    http.get<Paginated<StockMovement>>(`products/${id}/variants/${variantId}/stock`, { page, limit: 10 }),

  media: (id: string) => http.get<ProductMedia[]>(`products/${id}/media`),
  /** Multipart field name `file` is fixed by the backend. */
  uploadMedia: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http.post<ProductMedia>(`products/${id}/media`, form);
  },
  removeMedia: (id: string, mediaId: string) => http.delete<{ message: string }>(`products/${id}/media/${mediaId}`),
};
