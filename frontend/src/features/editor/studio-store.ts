"use client";

import { create } from "zustand";

export type LeftPanel = "content" | "assets";
export type RightPanel = "properties" | "ai";
export type MobileSheet = LeftPanel | RightPanel | null;

/** Studio UI-only state (never server data). */
interface StudioState {
  left: LeftPanel;
  right: RightPanel;
  mobileSheet: MobileSheet;
  /** Pre-filled AI request (e.g. "rewrite" with the current selection). */
  aiPrefill: { action: "rewrite"; text: string } | null;
  setLeft: (panel: LeftPanel) => void;
  setRight: (panel: RightPanel) => void;
  openSheet: (sheet: MobileSheet) => void;
  requestRewrite: (text: string) => void;
  clearAiPrefill: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  left: "content",
  right: "properties",
  mobileSheet: null,
  aiPrefill: null,
  setLeft: (left) => set({ left }),
  setRight: (right) => set({ right }),
  openSheet: (mobileSheet) => set({ mobileSheet }),
  requestRewrite: (text) =>
    set({ right: "ai", mobileSheet: "ai", aiPrefill: { action: "rewrite", text } }),
  clearAiPrefill: () => set({ aiPrefill: null }),
}));
