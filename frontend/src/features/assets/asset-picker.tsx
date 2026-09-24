"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlays";
import type { Asset } from "@/lib/api/opportunities";
import { cn } from "@/lib/utils/cn";
import { UploadZone } from "./asset-panel";
import { useAssets } from "./hooks";

/** Choose assets for an Image (single) or Gallery (multiple) block. */
export function AssetPicker({
  opportunityId,
  open,
  multiple,
  onOpenChange,
  onConfirm,
}: {
  opportunityId: string;
  open: boolean;
  multiple: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assets: Asset[]) => void;
}) {
  const assets = useAssets(opportunityId);
  const [selected, setSelected] = useState<string[]>([]);
  const images = (assets.data ?? []).filter((asset) => asset.mimeType !== "application/pdf");

  const toggle = (id: string) =>
    setSelected((current) =>
      multiple
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    );

  const close = (value: boolean) => {
    if (!value) {
      setSelected([]);
    }
    onOpenChange(value);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="lg"
      title={multiple ? "Choose gallery images" : "Choose an image"}
      description={multiple ? "Select two or more images, in display order." : "Select an uploaded image or upload a new one."}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={multiple ? selected.length < 2 : selected.length !== 1}
            onClick={() => {
              const byId = new Map(images.map((asset) => [asset.id, asset]));
              onConfirm(selected.map((id) => byId.get(id)).filter((asset): asset is Asset => Boolean(asset)));
              close(false);
            }}
          >
            {multiple ? `Insert gallery (${selected.length})` : "Insert image"}
          </Button>
        </>
      }
    >
      <UploadZone
        opportunityId={opportunityId}
        compact
        onUploaded={(uploaded) =>
          setSelected((current) =>
            multiple ? [...current, ...uploaded.map((asset) => asset.id)] : [uploaded[0].id],
          )
        }
      />
      <div className="mt-4">
        {assets.isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="aspect-square" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyState title="No images yet" description="Upload an image above to insert it." />
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Images">
            {images.map((asset) => {
              const order = selected.indexOf(asset.id);
              const isSelected = order !== -1;
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={asset.altText || asset.originalFilename || "Image"}
                    onClick={() => toggle(asset.id)}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-md border-2 transition-colors",
                      isSelected ? "border-accent" : "border-transparent hover:border-border-strong",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                    <img src={asset.url} alt="" className="size-full object-cover" />
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[0.625rem] font-bold text-accent-ink">
                        {multiple ? order + 1 : <Check className="size-3" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
