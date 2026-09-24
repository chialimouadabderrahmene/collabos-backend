import "server-only";

import { cache } from "react";
import { serverEnv } from "@/lib/env.server";
import type { Brand } from "./brands";
import type { Drop, DropMedia, DropPage, DropProduct, DropSeo } from "./drops";

export interface PublicDrop {
  drop: Drop;
  page: DropPage;
  seo: DropSeo;
  media: DropMedia[];
  products: DropProduct[];
  brand: Pick<Brand, "id" | "name" | "logoUrl"> | null;
}

export type PublicDropResult = { status: "ok"; data: PublicDrop } | { status: "unavailable" } | { status: "error" };

const SLUG_SHAPE = /^[a-z0-9-]{1,160}$/;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${serverEnv.apiUrl}/v1/${path}`, { cache: "no-store" });
  if (!response.ok) throw Object.assign(new Error(path), { status: response.status });
  return (await response.json()) as T;
}

/**
 * Anonymous server-side fetch of a published drop. The backend only returns
 * PUBLISHED drops that aren't PRIVATE to anonymous callers (404 otherwise).
 */
export const fetchPublicDrop = cache(async (slug: string): Promise<PublicDropResult> => {
  if (!SLUG_SHAPE.test(slug)) return { status: "unavailable" };
  try {
    const drop = await get<Drop>(`drops/slug/${encodeURIComponent(slug)}`);
    const [page, seo, media, products, brand] = await Promise.all([
      get<DropPage>(`drops/${drop.id}/page`),
      get<DropSeo>(`drops/${drop.id}/seo`),
      get<DropMedia[]>(`drops/${drop.id}/media`),
      get<DropProduct[]>(`drops/${drop.id}/products`),
      get<Brand>(`brands/${drop.brandId}`).catch(() => null),
    ]);
    return {
      status: "ok",
      data: {
        drop,
        page,
        seo,
        media,
        products: products.filter((product) => product.isAvailable).sort((a, b) => a.position - b.position),
        brand: brand && { id: brand.id, name: brand.name, logoUrl: brand.logoUrl },
      },
    };
  } catch (error) {
    return (error as { status?: number }).status === 404 ? { status: "unavailable" } : { status: "error" };
  }
});
