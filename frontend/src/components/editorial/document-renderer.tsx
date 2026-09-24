import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  assetIdFromRef,
  isDocNode,
  isSafeHref,
  type DocMark,
  type DocNode,
  type Presentation,
} from "@/features/editor/document-model";
import { cn } from "@/lib/utils/cn";

export interface ResolvedAsset {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
}

export type AssetResolver = (assetId: string) => ResolvedAsset | null;

/* -------------------------------------------------------------- marks */

function renderMarks(text: string, marks: DocMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-m${index}`;
    switch (mark.type) {
      case "bold":
        return <strong key={markKey} className="font-bold text-[var(--pub-strong)]">{child}</strong>;
      case "italic":
        return <em key={markKey}>{child}</em>;
      case "strike":
        return <s key={markKey}>{child}</s>;
      case "underline":
        return <u key={markKey}>{child}</u>;
      case "code":
        return (
          <code key={markKey} className="rounded-sm bg-white/5 px-1 py-0.5 font-mono text-[0.9em]">
            {child}
          </code>
        );
      case "link": {
        const href = mark.attrs?.href;
        return isSafeHref(href) ? (
          <a
            key={markKey}
            href={href}
            target={href.startsWith("#") ? undefined : "_blank"}
            rel="noopener noreferrer nofollow"
            className="text-[var(--pub-accent)] underline decoration-[var(--pub-accent)]/40 underline-offset-4 transition-colors hover:decoration-[var(--pub-accent)]"
          >
            {child}
          </a>
        ) : (
          child
        );
      }
      default:
        return child;
    }
  }, text);
}

/* -------------------------------------------------------------- nodes */

interface RenderContext {
  resolve: AssetResolver;
  presentation: Presentation;
}

function Figure({
  assetId,
  alt,
  caption,
  layout,
  ctx,
}: {
  assetId: string | null;
  alt?: unknown;
  caption?: unknown;
  layout?: unknown;
  ctx: RenderContext;
}) {
  const asset = assetId ? ctx.resolve(assetId) : null;
  const altText = (typeof alt === "string" && alt) || asset?.alt || "";
  const width = layout === "full" ? "full" : layout === "inline" ? "inline" : "wide";
  return (
    <figure
      className={cn(
        "my-[var(--pub-block-gap)]",
        width === "full" && "-mx-5 @xl:-mx-8",
        width === "inline" && "mx-auto max-w-md",
      )}
    >
      {asset ? (
        asset.mimeType === "application/pdf" ? (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-[var(--pub-rule)] px-4 py-3 text-sm"
          >
            <span>{altText || "Reference document (PDF)"}</span>
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; cannot be optimised by next/image
          <img
            src={asset.url}
            alt={altText}
            width={asset.width ?? undefined}
            height={asset.height ?? undefined}
            loading="lazy"
            decoding="async"
            className={cn("block h-auto w-full object-cover", width !== "full" && "rounded-md")}
          />
        )
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center rounded-md border border-dashed border-[var(--pub-rule)] text-sm text-[var(--pub-muted)]">
          Image unavailable
        </div>
      )}
      {typeof caption === "string" && caption && (
        <figcaption className="mt-3 text-[0.8125rem] text-[var(--pub-muted)]">{caption}</figcaption>
      )}
    </figure>
  );
}

function renderNode(node: DocNode, key: string, ctx: RenderContext): ReactNode {
  const children = () =>
    node.content?.map((child, index) => renderNode(child, `${key}.${index}`, ctx));

  switch (node.type) {
    case "text":
      return node.text ? renderMarks(node.text, node.marks, key) : null;
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return node.content?.length ? (
        <p key={key} className="my-[var(--pub-text-gap)] text-[var(--pub-body-size)] leading-[1.75]">
          {children()}
        </p>
      ) : (
        <div key={key} aria-hidden className="h-[var(--pub-text-gap)]" />
      );
    case "heading": {
      const level = Number(node.attrs?.level) || 2;
      const className = cn(
        "font-display font-bold tracking-tight text-[var(--pub-strong)] [text-wrap:balance]",
        ctx.presentation.typography === "editorial" && "uppercase tracking-[0.04em]",
        level === 1 && "mt-[var(--pub-section-gap)] mb-5 text-3xl @xl:text-4xl leading-[1.05]",
        level === 2 && "mt-[var(--pub-section-gap)] mb-4 text-2xl @xl:text-[1.75rem] leading-[1.15]",
        level >= 3 && "mt-10 mb-3 text-lg @xl:text-xl leading-snug text-[var(--pub-accent-heading)]",
      );
      if (level === 1) {
        return <h2 key={key} className={className}>{children()}</h2>;
      }
      if (level === 2) {
        return <h3 key={key} className={className}>{children()}</h3>;
      }
      return <h4 key={key} className={className}>{children()}</h4>;
    }
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-[var(--pub-block-gap)] border-l-2 border-[var(--pub-accent)] pl-6 font-display text-xl leading-snug font-medium text-[var(--pub-strong)] @xl:text-2xl [&_p]:my-2 [&_p]:text-inherit [&_p]:leading-snug"
        >
          {children()}
        </blockquote>
      );
    case "bulletList":
      return (
        <ul key={key} className="my-[var(--pub-text-gap)] list-disc space-y-2 pl-6 marker:text-[var(--pub-accent)] [&_p]:my-0">
          {children()}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="my-[var(--pub-text-gap)] list-decimal space-y-2 pl-6 marker:font-bold marker:text-[var(--pub-accent)] [&_p]:my-0">
          {children()}
        </ol>
      );
    case "listItem":
      return (
        <li key={key} className="pl-1 text-[var(--pub-body-size)] leading-[1.7]">
          {children()}
        </li>
      );
    case "horizontalRule":
      return (
        <div key={key} role="separator" className="my-[var(--pub-section-gap)] flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--pub-rule)]" />
          <span className="size-1.5 rounded-full bg-[var(--pub-accent)]" />
          <span className="h-px flex-1 bg-[var(--pub-rule)]" />
        </div>
      );
    case "assetImage":
      return (
        <Figure
          key={key}
          assetId={assetIdFromRef(node.attrs?.src)}
          alt={node.attrs?.alt}
          caption={node.attrs?.caption}
          layout={node.attrs?.layout}
          ctx={ctx}
        />
      );
    case "gallery": {
      const items = Array.isArray(node.attrs?.items) ? node.attrs.items : [];
      const columns = Number(node.attrs?.columns) === 3 ? 3 : 2;
      return (
        <figure key={key} className="my-[var(--pub-block-gap)]">
          <div className={cn("grid gap-2 @xl:gap-3", columns === 3 ? "grid-cols-2 @xl:grid-cols-3" : "grid-cols-2")}>
            {items.map((ref, index) => {
              const assetId = assetIdFromRef(ref);
              const asset = assetId ? ctx.resolve(assetId) : null;
              return asset ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URLs
                <img
                  key={`${key}-g${index}`}
                  src={asset.url}
                  alt={asset.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full rounded-md object-cover"
                />
              ) : (
                <div key={`${key}-g${index}`} className="aspect-[4/5] rounded-md border border-dashed border-[var(--pub-rule)]" />
              );
            })}
          </div>
          {typeof node.attrs?.caption === "string" && node.attrs.caption && (
            <figcaption className="mt-3 text-[0.8125rem] text-[var(--pub-muted)]">{node.attrs.caption}</figcaption>
          )}
        </figure>
      );
    }
    case "ctaSection": {
      const href = node.attrs?.href;
      const label = typeof node.attrs?.label === "string" && node.attrs.label ? node.attrs.label : "Get in touch";
      return (
        <aside
          key={key}
          className="my-[var(--pub-section-gap)] rounded-lg border border-[var(--pub-accent)]/35 bg-[var(--pub-accent)]/[0.07] p-6 @xl:p-8"
        >
          {typeof node.attrs?.heading === "string" && node.attrs.heading && (
            <p className="font-display text-xl font-bold text-[var(--pub-strong)] @xl:text-2xl">
              {node.attrs.heading}
            </p>
          )}
          {typeof node.attrs?.body === "string" && node.attrs.body && (
            <p className="mt-2 text-[var(--pub-body-size)] text-[var(--pub-muted)]">{node.attrs.body}</p>
          )}
          {isSafeHref(href) && (
            <a
              href={href}
              target={href.startsWith("#") ? undefined : "_blank"}
              rel="noopener noreferrer nofollow"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {label} <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
        </aside>
      );
    }
    default:
      // Unknown node types are skipped rather than rendered unsafely.
      return node.content ? <div key={key}>{children()}</div> : null;
  }
}

/* ------------------------------------------------------------ public */

const WIDTH = { narrow: "max-w-[38rem]", standard: "max-w-[44rem]", wide: "max-w-[52rem]" } as const;
const SPACING = {
  compact: { text: "0.75rem", block: "1.75rem", section: "2.5rem" },
  comfortable: { text: "1.1rem", block: "2.5rem", section: "3.5rem" },
  airy: { text: "1.4rem", block: "3.5rem", section: "5rem" },
} as const;

export function publicationStyle(presentation: Presentation): React.CSSProperties {
  const spacing = SPACING[presentation.spacing];
  const accent = presentation.style === "mono" ? "#ffffff" : "#c8ff00";
  return {
    ["--pub-accent" as string]: accent,
    ["--pub-accent-heading" as string]: presentation.style === "lime" ? "#c8ff00" : "#ffffff",
    ["--pub-strong" as string]: "#ffffff",
    ["--pub-muted" as string]: "#909090",
    ["--pub-rule" as string]: "#2a2a2a",
    ["--pub-body-size" as string]: presentation.typography === "editorial" ? "1.0625rem" : "1rem",
    ["--pub-text-gap" as string]: spacing.text,
    ["--pub-block-gap" as string]: spacing.block,
    ["--pub-section-gap" as string]: spacing.section,
  };
}

export function publicationWidth(presentation: Presentation): string {
  return WIDTH[presentation.layout];
}

/** Renders a structured document to semantic React elements. There is no
 * HTML injection path: every node type is mapped explicitly. */
export function DocumentRenderer({
  content,
  resolveAsset,
  presentation,
}: {
  content: unknown;
  resolveAsset: AssetResolver;
  presentation: Presentation;
}) {
  if (!isDocNode(content) || !content.content) {
    return null;
  }
  const ctx: RenderContext = { resolve: resolveAsset, presentation };
  return (
    <div className="text-fg-2 [&>*:first-child]:mt-0">
      {content.content.map((node, index) => renderNode(node, `n${index}`, ctx))}
    </div>
  );
}
