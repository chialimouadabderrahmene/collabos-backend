"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowUpRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAssetMap } from "./asset-context";
import { assetIdFromRef } from "./document-model";

/* ------------------------------------------------------------ image */

function AssetImageView({ node, selected }: ReactNodeViewProps) {
  const assets = useAssetMap();
  const assetId = assetIdFromRef(node.attrs.src);
  const asset = assetId ? assets.get(assetId) : undefined;
  const layout = node.attrs.layout as string;
  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        "my-6 rounded-md transition-shadow",
        selected && "ring-2 ring-accent ring-offset-4 ring-offset-bg",
        layout === "inline" && "mx-auto max-w-sm",
      )}
    >
      {asset && asset.mimeType !== "application/pdf" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, editor preview
        <img
          src={asset.url}
          alt={node.attrs.alt || asset.altText || ""}
          className="block h-auto w-full rounded-md"
          draggable={false}
        />
      ) : asset ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-body">
          <span>{asset.originalFilename ?? "Reference PDF"}</span>
          <ArrowUpRight className="size-4 text-muted" aria-hidden />
        </div>
      ) : (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong text-caption text-muted">
          <ImageOff className="size-5" aria-hidden />
          Asset unavailable — it may have been deleted
        </div>
      )}
      {node.attrs.caption && (
        <p className="mt-2 text-caption text-muted">{node.attrs.caption}</p>
      )}
    </NodeViewWrapper>
  );
}

export const AssetImage = Node.create({
  name: "assetImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      layout: { default: "wide" },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-asset-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-asset-image": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AssetImageView);
  },
});

/* ---------------------------------------------------------- gallery */

function GalleryView({ node, selected }: ReactNodeViewProps) {
  const assets = useAssetMap();
  const items: string[] = Array.isArray(node.attrs.items) ? node.attrs.items : [];
  const columns = Number(node.attrs.columns) === 3 ? 3 : 2;
  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        "my-6 rounded-md transition-shadow",
        selected && "ring-2 ring-accent ring-offset-4 ring-offset-bg",
      )}
    >
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {items.map((ref, index) => {
          const asset = assets.get(assetIdFromRef(ref) ?? "");
          return asset ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, editor preview
            <img
              key={`${ref}-${index}`}
              src={asset.url}
              alt={asset.altText ?? ""}
              className="aspect-[4/5] w-full rounded-md object-cover"
              draggable={false}
            />
          ) : (
            <div key={`${ref}-${index}`} className="aspect-[4/5] rounded-md border border-dashed border-border-strong" />
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full flex aspect-[16/6] items-center justify-center rounded-md border border-dashed border-border-strong text-caption text-muted">
            Empty gallery — add images from the Properties panel
          </div>
        )}
      </div>
      {node.attrs.caption && <p className="mt-2 text-caption text-muted">{node.attrs.caption}</p>}
    </NodeViewWrapper>
  );
}

export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      items: { default: [] },
      columns: { default: 2 },
      caption: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-gallery]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gallery": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },
});

/* ------------------------------------------------------------- CTA */

function CtaView({ node, selected }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        "my-8 rounded-lg border border-accent-line bg-accent-tint/70 p-6 transition-shadow",
        selected && "ring-2 ring-accent ring-offset-4 ring-offset-bg",
      )}
    >
      <p className="font-display text-heading text-fg">
        {node.attrs.heading || <span className="text-faint">Call-to-action heading</span>}
      </p>
      {node.attrs.body && <p className="mt-1.5 text-body text-muted">{node.attrs.body}</p>}
      <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-caption font-bold text-accent-ink">
        {node.attrs.label || "Get in touch"} <ArrowUpRight className="size-4" aria-hidden />
      </span>
      {!node.attrs.href && (
        <p className="mt-3 text-caption text-warning">Add a link in the Properties panel.</p>
      )}
    </NodeViewWrapper>
  );
}

export const CtaSection = Node.create({
  name: "ctaSection",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      heading: { default: "" },
      body: { default: "" },
      label: { default: "Get in touch" },
      href: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "aside[data-cta]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-cta": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CtaView);
  },
});

/* -------------------------------------------------------- extension set */

export function studioExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      link: false,
      underline: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
      defaultProtocol: "https",
      isAllowedUri: (url, ctx) =>
        /^(https?:|mailto:|#)/i.test(url) && ctx.defaultValidate(url),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading"
          ? "Heading"
          : "Write, or press “/” for blocks…",
    }),
    AssetImage,
    Gallery,
    CtaSection,
  ];
}
