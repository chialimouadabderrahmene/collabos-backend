"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Monitor, Smartphone, Tablet, Upload, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Publication, resolverFrom } from "@/components/editorial/publication";
import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { useAssets } from "@/features/assets/hooks";
import { readPresentation } from "@/features/editor/document-model";
import { useActiveBrand } from "@/features/brands/workspace";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { useOpportunity } from "./hooks";

export type Device = "desktop" | "tablet" | "mobile";

const DEVICES: Array<{ id: Device; label: string; icon: LucideIcon; width: string }> = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "w-full" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "w-[768px] max-w-full" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "w-[390px] max-w-full" },
];

export function DeviceSwitch({ value, onChange }: { value: Device; onChange: (device: Device) => void }) {
  return (
    <div role="radiogroup" aria-label="Preview device" className="flex gap-1 rounded-md border border-border bg-surface p-1">
      {DEVICES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={label}
          title={label}
          onClick={() => onChange(id)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-caption font-semibold transition-colors",
            value === id ? "bg-accent text-accent-ink" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Frames content at a device width. The publication uses container queries,
 * so it responds to this frame exactly as it would on that device. */
export function DeviceFrame({ device, children }: { device: Device; children: ReactNode }) {
  const width = DEVICES.find((item) => item.id === device)?.width ?? "w-full";
  return (
    <div className="flex justify-center px-3 py-6 sm:px-6">
      <div
        className={cn(
          "overflow-hidden bg-bg transition-[width] duration-300",
          width,
          device !== "desktop" && "rounded-xl border border-border-strong shadow-2xl shadow-black/50",
        )}
      >
        <div className={cn(device !== "desktop" && "max-h-[80dvh] overflow-y-auto")}>{children}</div>
      </div>
    </div>
  );
}

export function PreviewScreen({ opportunityId }: { opportunityId: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const { brand } = useActiveBrand();
  const opportunity = useOpportunity(opportunityId);
  const draft = useQuery({
    queryKey: queryKeys.opportunities.draft(opportunityId),
    queryFn: () => opportunitiesApi.getDraft(opportunityId),
    refetchOnMount: "always",
  });
  const assets = useAssets(opportunityId);

  const failed = opportunity.error ?? draft.error;
  if (failed) {
    const notFound = failed instanceof ApiError && failed.isNotFound;
    return (
      <div className="mx-auto max-w-md px-6 pt-24">
        <ErrorState title={notFound ? "Opportunity not found" : "Couldn't load the preview"} onRetry={notFound ? undefined : () => void draft.refetch()} />
      </div>
    );
  }
  if (!opportunity.data || !draft.data || assets.isLoading) {
    return <LoadingState label="Rendering preview" className="min-h-dvh" />;
  }

  const data = opportunity.data;
  const canPublish = Boolean(data.capabilities?.publish) && !data.archivedAt;
  const blank = draft.data.format === "blank";
  const brandInfo = brand && brand.id === data.brandId ? { name: brand.name, logoUrl: brand.logoUrl } : null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-3 backdrop-blur sm:px-4">
        <Link
          href={data.capabilities?.edit ? `/opportunities/${data.id}/studio` : `/opportunities/${data.id}`}
          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-caption font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{data.capabilities?.edit ? "Back to Studio" : "Back"}</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Badge tone="warning">Draft preview</Badge>
          {draft.data.hasUnpublishedChanges && data.latestVersionNumber > 0 && (
            <span className="hidden truncate text-caption text-muted md:inline">
              Differs from published v{data.latestVersionNumber}
            </span>
          )}
        </div>
        <DeviceSwitch value={device} onChange={setDevice} />
        {canPublish && (
          <Button asChild size="sm">
            <Link href={`/opportunities/${data.id}/publish`}>
              <Upload className="size-4" aria-hidden /> <span className="hidden sm:inline">Publish</span>
            </Link>
          </Button>
        )}
      </header>

      <DeviceFrame device={device}>
        {blank ? (
          <div className="px-6 py-24 text-center text-body text-muted">
            This draft is empty. Add content in the Studio to preview it.
          </div>
        ) : (
          <Publication
            className="py-12"
            title={data.title}
            summary={data.summary}
            content={draft.data.content}
            presentation={readPresentation(data.metadata)}
            resolveAsset={resolverFrom(assets.data ?? [])}
            brand={brandInfo}
            meta={`Draft · revision ${draft.data.revision}`}
          />
        )}
      </DeviceFrame>
    </div>
  );
}
