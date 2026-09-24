"use client";

import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { brandsApi, type BrandMemberRole } from "@/lib/api/brands";
import { queryKeys } from "@/lib/api/query-keys";

/** UI-only preference: which of my brands is the active workspace. The brand
 * list itself is server state (TanStack Query), never duplicated here. */
interface WorkspaceState {
  activeBrandId: string | null;
  setActiveBrandId: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeBrandId: null,
      setActiveBrandId: (id) => set({ activeBrandId: id }),
    }),
    { name: "collabos.workspace" },
  ),
);

export function useMyBrands() {
  return useQuery({ queryKey: queryKeys.brands.mine, queryFn: brandsApi.mine });
}

/** The active brand: the persisted choice if still valid, else the first. */
export function useActiveBrand() {
  const brands = useMyBrands();
  const activeBrandId = useWorkspaceStore((state) => state.activeBrandId);
  const setActiveBrandId = useWorkspaceStore((state) => state.setActiveBrandId);

  const list = brands.data ?? [];
  const brand = list.find((item) => item.id === activeBrandId) ?? list[0] ?? null;

  return {
    brand,
    brands: list,
    isLoading: brands.isLoading,
    isError: brands.isError,
    refetch: brands.refetch,
    setActiveBrandId,
  };
}

const ROLE_RANK: Record<BrandMemberRole, number> = { VIEWER: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 };

/** UX-only permission hint. The backend enforces every permission. */
export function roleAtLeast(role: BrandMemberRole | undefined, minimum: BrandMemberRole): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[minimum];
}
