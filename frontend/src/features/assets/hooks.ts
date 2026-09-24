"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { assetsApi, ASSET_MAX_BYTES } from "@/lib/api/assets";
import { ApiError } from "@/lib/api/http";
import type { Asset, AssetKind } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";

/** Refresh signed URLs one minute before the earliest one expires. */
export function refreshIntervalFor(assets: Asset[] | undefined, now = Date.now()): number | false {
  if (!assets || assets.length === 0) {
    return false;
  }
  const earliest = Math.min(...assets.map((asset) => new Date(asset.urlExpiresAt).getTime()));
  return Math.max(15_000, earliest - now - 60_000);
}

export function useAssets(opportunityId: string) {
  return useQuery({
    queryKey: queryKeys.opportunities.assets(opportunityId),
    queryFn: () => assetsApi.list(opportunityId),
    refetchInterval: (query) => refreshIntervalFor(query.state.data),
    refetchIntervalInBackground: false,
  });
}

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

/** Client-side pre-checks only (fast feedback). The backend sniffs file
 * content and is the authority on what is accepted. */
export function precheckFile(file: File, kind: AssetKind): string | null {
  if (file.size > ASSET_MAX_BYTES) {
    return "Files must be smaller than 15 MB.";
  }
  if (!ACCEPTED.has(file.type)) {
    return "Use JPEG, PNG, WEBP or GIF images (PDF for references).";
  }
  if (file.type === "application/pdf" && kind !== "REFERENCE") {
    return "PDFs can only be uploaded as references.";
  }
  return null;
}

export function useAssetUploads(opportunityId: string) {
  const client = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = (id: string, change: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const upload = useCallback(
    async (files: File[], kind: AssetKind): Promise<Asset[]> => {
      const uploaded: Asset[] = [];
      await Promise.all(
        files.map(async (file) => {
          const id = `${file.name}-${file.size}-${crypto.randomUUID()}`;
          const problem = precheckFile(file, kind);
          setItems((current) => [
            ...current,
            { id, name: file.name, progress: 0, status: problem ? "error" : "uploading", error: problem ?? undefined },
          ]);
          if (problem) {
            return;
          }
          try {
            const asset = await assetsApi.upload(opportunityId, { file, kind }, (progress) =>
              patch(id, { progress }),
            );
            uploaded.push(asset);
            patch(id, { progress: 1, status: "done" });
            client.setQueryData<Asset[]>(queryKeys.opportunities.assets(opportunityId), (previous) =>
              previous ? [...previous, asset] : [asset],
            );
            setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 1500);
          } catch (error) {
            patch(id, {
              status: "error",
              error: error instanceof ApiError ? error.message : "Upload failed.",
            });
          }
        }),
      );
      return uploaded;
    },
    [client, opportunityId],
  );

  const dismiss = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  return { items, upload, dismiss };
}

export function useDeleteAsset(opportunityId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => assetsApi.remove(opportunityId, assetId),
    onSuccess: (_result, assetId) =>
      client.setQueryData<Asset[]>(queryKeys.opportunities.assets(opportunityId), (previous) =>
        previous?.filter((asset) => asset.id !== assetId),
      ),
  });
}

export function useUpdateAltText(opportunityId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, altText }: { assetId: string; altText: string }) =>
      assetsApi.updateAltText(opportunityId, assetId, altText),
    onSuccess: (asset) =>
      client.setQueryData<Asset[]>(queryKeys.opportunities.assets(opportunityId), (previous) =>
        previous?.map((item) => (item.id === asset.id ? asset : item)),
      ),
  });
}
