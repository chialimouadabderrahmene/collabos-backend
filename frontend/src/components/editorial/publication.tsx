import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/display";
import type { Presentation } from "@/features/editor/document-model";
import { cn } from "@/lib/utils/cn";
import {
  DocumentRenderer,
  publicationStyle,
  publicationWidth,
  type AssetResolver,
} from "./document-renderer";

export interface PublicationProps {
  title: string;
  summary: string | null;
  content: unknown;
  presentation: Presentation;
  resolveAsset: AssetResolver;
  brand?: { name: string; logoUrl: string | null } | null;
  /** e.g. "Version 3 · 12 Mar 2026" */
  meta?: ReactNode;
  /** Optional ribbon above the masthead (preview / immutable notices). */
  notice?: ReactNode;
  className?: string;
}

/**
 * The editorial Opportunity publication. One component renders the Studio
 * preview, published versions and public share pages, so what an owner
 * previews is exactly what recipients see.
 */
export function Publication({
  title,
  summary,
  content,
  presentation,
  resolveAsset,
  brand,
  meta,
  notice,
  className,
}: PublicationProps) {
  const editorial = presentation.typography === "editorial";
  return (
    // Container queries: the publication adapts to its frame (device preview,
    // share page), not to the browser viewport.
    <div className="@container w-full">
    <article
      style={publicationStyle(presentation)}
      className={cn("mx-auto w-full px-5 @xl:px-8", publicationWidth(presentation), className)}
    >
      {notice && <div className="mb-8">{notice}</div>}
      <header className="border-b border-[var(--pub-rule)] pb-10">
        {brand && (
          <div className="mb-10 flex items-center gap-3">
            <Avatar name={brand.name} src={brand.logoUrl} size="sm" />
            <span className="text-[0.6875rem] font-bold tracking-[0.18em] text-[var(--pub-strong)] uppercase">
              {brand.name}
            </span>
            <span aria-hidden className="h-px flex-1 bg-[var(--pub-rule)]" />
            <span className="text-[0.6875rem] font-bold tracking-[0.18em] text-[var(--pub-accent)] uppercase">
              Opportunity
            </span>
          </div>
        )}
        <h1
          className={cn(
            "font-display text-[2.25rem] leading-[1.02] font-bold tracking-[-0.025em] text-[var(--pub-strong)] [text-wrap:balance] @xl:text-[3.25rem] @3xl:text-[3.75rem]",
            editorial && "uppercase tracking-[0.01em]",
          )}
        >
          {title}
        </h1>
        {summary && (
          <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-[var(--pub-muted)] [text-wrap:pretty] @xl:text-xl">
            {summary}
          </p>
        )}
        {meta && (
          <p className="mt-8 text-[0.75rem] font-semibold tracking-[0.12em] text-[var(--pub-muted)] uppercase">
            {meta}
          </p>
        )}
      </header>
      <div className="pt-10 pb-16">
        <DocumentRenderer content={content} resolveAsset={resolveAsset} presentation={presentation} />
      </div>
    </article>
    </div>
  );
}

/** Builds a resolver from an API asset list (draft assets or version assets). */
export function resolverFrom(
  assets: Array<{
    id: string;
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
    mimeType: string;
  }>,
): AssetResolver {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return (assetId) => {
    const asset = byId.get(assetId);
    return asset
      ? {
          url: asset.url,
          alt: asset.altText,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
        }
      : null;
  };
}
