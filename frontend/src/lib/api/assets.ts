import { ApiError, type ApiErrorBody, http } from "./http";
import type { Asset, AssetKind } from "./opportunities";

const base = (opportunityId: string) => `opportunities/${opportunityId}/assets`;

/** Mirrors the backend limit (OPPORTUNITY_ASSET_MAX_SIZE_MB, default 15). The
 * backend remains authoritative; this only avoids pointless uploads. */
export const ASSET_MAX_BYTES = 15 * 1024 * 1024;
export const ASSET_ACCEPT: Record<AssetKind, string> = {
  IMAGE: "image/jpeg,image/png,image/webp,image/gif",
  SKETCH: "image/jpeg,image/png,image/webp,image/gif",
  REFERENCE: "image/jpeg,image/png,image/webp,image/gif,application/pdf",
};

/**
 * Upload with progress. XMLHttpRequest is used (instead of fetch) because it
 * is the only browser API exposing upload progress events.
 */
function upload(
  opportunityId: string,
  input: { file: File; kind: AssetKind; altText?: string },
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("kind", input.kind);
    if (input.altText) {
      form.append("altText", input.altText);
    }
    form.append("file", input.file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/backend/${base(opportunityId)}`);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as Asset);
      } else {
        reject(new ApiError(xhr.status, body as ApiErrorBody | null));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, { message: "Network error during upload" }));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(form);
  });
}

export const assetsApi = {
  list: (opportunityId: string) => http.get<Asset[]>(base(opportunityId)),
  upload,
  updateAltText: (opportunityId: string, assetId: string, altText: string) =>
    http.patch<Asset>(`${base(opportunityId)}/${assetId}`, { altText }),
  remove: (opportunityId: string, assetId: string) =>
    http.delete<{ message: string }>(`${base(opportunityId)}/${assetId}`),
};
