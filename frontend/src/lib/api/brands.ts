import { http, type Paginated } from "./http";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface BrandProfile {
  description: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  contactEmail: string | null;
  foundedYear: number | null;
  location: string | null;
}

export interface Brand {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  followersCount: number;
  isActive: boolean;
  categories: Category[];
  profile: BrandProfile | null;
  createdAt: string;
}

export type BrandMemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

/** A brand I belong to, with my effective role (GET /brands/mine). */
export interface MyBrand extends Brand {
  role: BrandMemberRole;
}

export interface BrandMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: BrandMemberRole;
  isBrandOwner: boolean;
  createdAt: string;
}

export interface ListBrandsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  verifiedOnly?: boolean;
}

export interface UpdateBrandProfileInput {
  description?: string;
  websiteUrl?: string;
  instagramHandle?: string;
  contactEmail?: string;
  foundedYear?: number;
  location?: string;
}

export const brandsApi = {
  list: (query: ListBrandsQuery = {}, signal?: AbortSignal) =>
    http.get<Paginated<Brand>>("brands", { ...query }, signal),
  mine: () => http.get<MyBrand[]>("brands/mine"),
  get: (id: string) => http.get<Brand>(`brands/${id}`),
  create: (input: { name: string; categoryIds?: string[] }) => http.post<Brand>("brands", input),
  update: (id: string, input: { name?: string }) => http.patch<Brand>(`brands/${id}`, input),
  updateProfile: (id: string, input: UpdateBrandProfileInput) =>
    http.patch<BrandProfile>(`brands/${id}/profile`, input),
  setCategories: (id: string, categoryIds: string[]) =>
    http.patch<Brand>(`brands/${id}/categories`, { categoryIds }),
  /** Multipart field names are fixed by the backend (`logo`, `cover`). */
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return http.post<{ logoUrl: string | null }>(`brands/${id}/logo`, form);
  },
  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append("cover", file);
    return http.post<{ coverUrl: string | null }>(`brands/${id}/cover`, form);
  },
  follow: (id: string) => http.post<{ message: string }>(`brands/${id}/follow`),
  unfollow: (id: string) => http.delete<{ message: string }>(`brands/${id}/follow`),
  categories: () => http.get<Category[]>("categories"),

  members: {
    list: (brandId: string) => http.get<BrandMember[]>(`brands/${brandId}/members`),
    add: (brandId: string, input: { email: string; role: BrandMemberRole }) =>
      http.post<BrandMember>(`brands/${brandId}/members`, input),
    updateRole: (brandId: string, userId: string, role: BrandMemberRole) =>
      http.patch<BrandMember>(`brands/${brandId}/members/${userId}`, { role }),
    remove: (brandId: string, userId: string) =>
      http.delete<{ message: string }>(`brands/${brandId}/members/${userId}`),
  },
};
