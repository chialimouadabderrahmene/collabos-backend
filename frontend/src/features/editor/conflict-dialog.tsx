"use client";

import { Copy, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";
import { formatRelative } from "@/lib/utils/format";
import type { ConflictInfo } from "./autosave";
import { plainText } from "./document-model";

/**
 * Revision conflict (409): someone else saved the draft after this editor
 * loaded it. Autosave is paused and nothing is overwritten until the user
 * explicitly chooses.
 */
export function ConflictDialog({
  conflict,
  localRevision,
  getLocalContent,
  onReload,
  onKeepMine,
}: {
  conflict: ConflictInfo;
  localRevision: number;
  getLocalContent: () => unknown;
  onReload: () => Promise<void>;
  onKeepMine: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"reload" | "keep" | null>(null);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const server = conflict.serverDraft;
  const serverText = server ? plainText(server.content) : "";

  const run = async (action: "reload" | "keep") => {
    setBusy(action);
    try {
      await (action === "reload" ? onReload() : onKeepMine());
      toast.success(action === "reload" ? "Loaded the latest version" : "Your version was saved");
    } catch (error) {
      toast.error(
        "That didn't work",
        error instanceof ApiError ? error.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const copyMine = async () => {
    try {
      await navigator.clipboard.writeText(plainText(getLocalContent()));
      toast.success("Your text was copied to the clipboard");
    } catch {
      toast.error("Clipboard is unavailable in this browser");
    }
  };

  const downloadMine = () => {
    const blob = new Blob([JSON.stringify(getLocalContent(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-draft.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open
      onOpenChange={() => undefined}
      title="This draft was changed elsewhere"
      description="Another save happened after you started editing. Autosave is paused so nothing is overwritten."
      footer={
        confirmKeep ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmKeep(false)} disabled={busy !== null}>
              Back
            </Button>
            <Button variant="danger" loading={busy === "keep"} onClick={() => run("keep")}>
              Replace their changes
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setConfirmKeep(true)} disabled={busy !== null}>
              Keep my version…
            </Button>
            <Button loading={busy === "reload"} onClick={() => run("reload")}>
              <RefreshCw className="size-4" aria-hidden /> Load latest
            </Button>
          </>
        )
      }
    >
      {confirmKeep ? (
        <p className="text-body text-fg-2">
          Saving your version will <strong className="text-fg">replace</strong> the newer changes
          on the server (revision {conflict.currentRevision ?? server?.revision ?? "?"}). Those
          changes stay visible in the activity history only if they were published.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-caption">
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <dt className="text-muted">Your editor</dt>
              <dd className="mt-1 font-semibold text-fg">Based on revision {localRevision}</dd>
            </div>
            <div className="rounded-md border border-warning/30 bg-warning-tint p-3">
              <dt className="text-muted">Server</dt>
              <dd className="mt-1 font-semibold text-warning">
                Revision {conflict.currentRevision ?? server?.revision ?? "?"}
                {server && ` · ${formatRelative(server.updatedAt)}`}
              </dd>
            </div>
          </dl>
          {server && (
            <div>
              <p className="mb-1.5 text-label text-muted uppercase">Latest server version</p>
              <p className="line-clamp-5 rounded-md border border-border bg-surface-2 p-3 text-caption text-fg-2">
                {serverText || "Empty document"}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={copyMine}>
              <Copy className="size-3.5" aria-hidden /> Copy my text
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadMine}>
              <Download className="size-3.5" aria-hidden /> Download my draft
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
