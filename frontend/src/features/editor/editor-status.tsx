"use client";

import { AlertTriangle, Check, CircleDot, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";
import type { AutosaveState } from "./autosave";

/** Live save indicator. Announced politely to screen readers. */
export function EditorStatus({ state, className }: { state: AutosaveState; className?: string }) {
  // Re-render every 30s so "Saved 2 min ago" stays truthful.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const view = (() => {
    switch (state.status) {
      case "saving":
        return { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Saving…", tone: "text-muted" };
      case "dirty":
        return { icon: <CircleDot className="size-3.5" />, text: "Unsaved changes", tone: "text-muted" };
      case "saved":
        return {
          icon: <Check className="size-3.5" />,
          text: state.lastSavedAt ? `Saved ${formatRelative(state.lastSavedAt)}` : "Saved",
          tone: "text-accent",
        };
      case "error":
        return { icon: <CloudOff className="size-3.5" />, text: "Not saved — retrying on next edit", tone: "text-danger" };
      case "conflict":
        return { icon: <AlertTriangle className="size-3.5" />, text: "Edited elsewhere", tone: "text-warning" };
      default:
        return { icon: <Check className="size-3.5" />, text: "All changes saved", tone: "text-faint" };
    }
  })();

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-caption font-medium", view.tone, className)}
    >
      {view.icon}
      <span>{view.text}</span>
      <span className="tabular hidden text-faint sm:inline">· rev {state.revision}</span>
    </span>
  );
}
