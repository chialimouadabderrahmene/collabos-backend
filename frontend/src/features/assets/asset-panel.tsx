"use client";

import { FileText, ImagePlus, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ConfirmationDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { ASSET_ACCEPT } from "@/lib/api/assets";
import { ApiError } from "@/lib/api/http";
import type { Asset, AssetKind } from "@/lib/api/opportunities";
import { cn } from "@/lib/utils/cn";
import { useAssetUploads, useAssets, useDeleteAsset, useUpdateAltText } from "./hooks";

const KINDS: Array<{ value: AssetKind; label: string }> = [
  { value: "IMAGE", label: "Image" },
  { value: "SKETCH", label: "Sketch" },
  { value: "REFERENCE", label: "Reference" },
];

function formatBytes(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function UploadZone({
  opportunityId,
  compact = false,
  onUploaded,
  disabled = false,
}: {
  opportunityId: string;
  compact?: boolean;
  onUploaded?: (assets: Asset[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AssetKind>("IMAGE");
  const [dragging, setDragging] = useState(false);
  const { items, upload, dismiss } = useAssetUploads(opportunityId);

  const start = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) {
      return;
    }
    const uploaded = await upload(Array.from(files), kind);
    if (uploaded.length > 0) {
      onUploaded?.(uploaded);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void start(event.dataTransfer.files);
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Asset type" className="mb-2 grid grid-cols-3 gap-1 rounded-md border border-border bg-surface p-1">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={kind === option.value}
            onClick={() => setKind(option.value)}
            className={cn(
              "h-7 rounded-sm text-caption font-semibold transition-colors",
              kind === option.value ? "bg-accent text-accent-ink" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "py-4" : "py-7",
          dragging
            ? "border-accent bg-accent-tint"
            : "border-border-strong bg-surface hover:border-accent-line hover:bg-accent-tint/40",
        )}
      >
        <UploadCloud className="size-5 text-accent" aria-hidden />
        <span className="text-caption font-semibold text-fg">Drop files or browse</span>
        <span className="text-[0.6875rem] text-faint">
          JPG · PNG · WEBP · GIF{kind === "REFERENCE" ? " · PDF" : ""} — up to 15 MB
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ASSET_ACCEPT[kind]}
        className="sr-only"
        aria-label="Upload assets"
        onChange={(event) => {
          void start(event.target.files);
          event.target.value = "";
        }}
      />
      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="Uploads">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-caption">
                <span className="truncate text-fg-2">{item.name}</span>
                {item.status === "error" ? (
                  <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)} className="text-faint hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <span className="tabular text-muted">{Math.round(item.progress * 100)}%</span>
                )}
              </div>
              {item.status === "error" ? (
                <p role="alert" className="mt-1 text-[0.6875rem] text-danger">
                  {item.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(item.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${item.name}`}
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"
                >
                  <div
                    className={cn("h-full transition-[width]", item.status === "done" ? "bg-success" : "bg-accent")}
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetTile({
  asset,
  canEdit,
  onInsert,
  onDelete,
  onAltText,
}: {
  asset: Asset;
  canEdit: boolean;
  onInsert?: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onAltText: (asset: Asset, altText: string) => void;
}) {
  const [alt, setAlt] = useState(asset.altText ?? "");
  const isPdf = asset.mimeType === "application/pdf";
  return (
    <li className="group overflow-hidden rounded-md border border-border bg-surface">
      <div className="relative aspect-square bg-surface-2">
        {isPdf ? (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted">
            <FileText className="size-6" aria-hidden />
            <span className="text-[0.6875rem]">PDF</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL thumbnail
          <img src={asset.url} alt={asset.altText ?? ""} loading="lazy" className="size-full object-cover" />
        )}
        <Badge tone="neutral" className="absolute top-1.5 left-1.5 bg-bg/80 backdrop-blur">
          {asset.kind}
        </Badge>
        {canEdit && (
          <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            {onInsert && (
              <button
                type="button"
                onClick={() => onInsert(asset)}
                className="flex h-7 flex-1 items-center justify-center gap-1 rounded-sm bg-accent text-[0.6875rem] font-bold text-accent-ink"
              >
                <Plus className="size-3.5" aria-hidden /> Insert
              </button>
            )}
            <button
              type="button"
              aria-label={`Delete ${asset.originalFilename ?? "asset"}`}
              onClick={() => onDelete(asset)}
              className="flex size-7 items-center justify-center rounded-sm bg-bg/85 text-danger backdrop-blur hover:bg-danger-tint"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-[0.6875rem] text-fg-2" title={asset.originalFilename ?? undefined}>
          {asset.originalFilename ?? "Untitled"}
        </p>
        <p className="tabular text-[0.625rem] text-faint">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
          {formatBytes(asset.sizeBytes)}
        </p>
        {canEdit && (
          <>
            <label htmlFor={`alt-${asset.id}`} className="sr-only">
              Alt text
            </label>
            <input
              id={`alt-${asset.id}`}
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              onBlur={() => alt !== (asset.altText ?? "") && onAltText(asset, alt)}
              placeholder="Alt text"
              maxLength={500}
              className={cn(
                "mt-1.5 h-7 w-full rounded-sm border bg-surface-2 px-2 text-[0.6875rem] text-fg placeholder:text-faint focus:border-accent focus:outline-none",
                !asset.altText && !isPdf ? "border-warning/40" : "border-border",
              )}
            />
          </>
        )}
      </div>
    </li>
  );
}

/** Studio asset library: upload, preview, insert, alt text, delete. */
export function AssetPanel({
  opportunityId,
  canEdit,
  onInsert,
}: {
  opportunityId: string;
  canEdit: boolean;
  onInsert?: (asset: Asset) => void;
}) {
  const assets = useAssets(opportunityId);
  const remove = useDeleteAsset(opportunityId);
  const altText = useUpdateAltText(opportunityId);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success("Asset deleted");
        setPendingDelete(null);
      },
      onError: (error) => {
        setPendingDelete(null);
        toast.error(
          error instanceof ApiError && error.isConflict ? "Asset is in use" : "Couldn't delete asset",
          error instanceof ApiError ? error.message : undefined,
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit && <UploadZone opportunityId={opportunityId} />}
      {assets.isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-square" />
          ))}
        </div>
      ) : assets.isError ? (
        <ErrorState title="Couldn't load assets" onRetry={() => assets.refetch()} />
      ) : assets.data && assets.data.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2" aria-label="Assets">
          {assets.data.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              canEdit={canEdit}
              onInsert={onInsert}
              onDelete={setPendingDelete}
              onAltText={(target, value) =>
                altText.mutate(
                  { assetId: target.id, altText: value },
                  { onError: () => toast.error("Couldn't save alt text") },
                )
              }
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ImagePlus className="size-5" />}
          title="No assets yet"
          description="Upload images, sketches and references to use in the document."
        />
      )}
      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this asset?"
        description="It can't be deleted while the draft uses it. Published versions keep their copy."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
