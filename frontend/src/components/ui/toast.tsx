"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const TOAST_TTL_MS = 5000;

/** UI-only global state: the one place a Zustand store is warranted for
 * toasts (fired from anywhere, rendered once in the root). */
const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] });
    setTimeout(() => get().dismiss(id), TOAST_TTL_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "error", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "info", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: "warning", title, description }),
};

const ICONS = {
  success: <CheckCircle2 className="size-4 text-accent" aria-hidden />,
  error: <XCircle className="size-4 text-danger" aria-hidden />,
  info: <Info className="size-4 text-info" aria-hidden />,
  warning: <TriangleAlert className="size-4 text-warning" aria-hidden />,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg border bg-surface-2 px-4 py-3 shadow-2xl shadow-black/60",
            item.tone === "error" ? "border-danger/30" : "border-border-strong",
          )}
        >
          <span className="mt-0.5">{ICONS[item.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-fg">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-caption text-muted">{item.description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
            className="rounded-sm p-0.5 text-faint hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
