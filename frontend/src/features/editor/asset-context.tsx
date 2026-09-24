"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Asset } from "@/lib/api/opportunities";

/** Signed URLs for the current opportunity's assets, keyed by asset id.
 * Node views read from here so the document itself only ever stores
 * `asset:<uuid>` references. */
const AssetContext = createContext<Map<string, Asset>>(new Map());

export function AssetProvider({ assets, children }: { assets: Asset[]; children: ReactNode }) {
  return (
    <AssetContext.Provider value={new Map(assets.map((asset) => [asset.id, asset]))}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAssetMap(): Map<string, Asset> {
  return useContext(AssetContext);
}
