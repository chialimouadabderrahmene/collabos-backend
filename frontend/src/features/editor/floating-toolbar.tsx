"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  Link2Off,
  Quote,
  Sparkles,
  Strikethrough,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { isSafeHref } from "./document-model";
import { useStudioStore } from "./studio-store";

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm transition-colors",
        active ? "bg-accent text-accent-ink" : "text-fg-2 hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/** Inline formatting toolbar shown over a text selection. */
export function FloatingToolbar({ editor }: { editor: Editor }) {
  const requestRewrite = useStudioStore((state) => state.requestRewrite);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      link: current.isActive("link"),
      heading: current.isActive("heading", { level: 2 }),
      quote: current.isActive("blockquote"),
    }),
  });

  const applyLink = () => {
    const href = (linkDraft ?? "").trim();
    const normalised = /^(https?:|mailto:|#)/i.test(href) ? href : `https://${href}`;
    if (href && isSafeHref(normalised)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalised }).run();
    }
    setLinkDraft(null);
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current, state }) =>
        !state.selection.empty &&
        current.isEditable &&
        !current.isActive("assetImage") &&
        !current.isActive("gallery") &&
        !current.isActive("ctaSection")
      }
      className="z-40 flex items-center gap-0.5 rounded-md border border-border-strong bg-surface-2 p-1 shadow-2xl shadow-black/60"
    >
      {linkDraft !== null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
          className="flex items-center gap-1"
        >
          <label htmlFor="studio-link" className="sr-only">
            Link URL
          </label>
          <input
            id="studio-link"
            autoFocus
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setLinkDraft(null)}
            placeholder="https://…"
            className="h-8 w-56 rounded-sm border border-border bg-surface px-2 text-caption text-fg focus:border-accent focus:outline-none"
          />
          <button type="submit" className="h-8 rounded-sm bg-accent px-2.5 text-caption font-bold text-accent-ink">
            Apply
          </button>
        </form>
      ) : (
        <>
          <ToolButton label="Bold" active={marks.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </ToolButton>
          <ToolButton label="Italic" active={marks.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" />
          </ToolButton>
          <ToolButton label="Strikethrough" active={marks.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="size-4" />
          </ToolButton>
          {marks.link ? (
            <ToolButton label="Remove link" active onClick={() => editor.chain().focus().unsetLink().run()}>
              <Link2Off className="size-4" />
            </ToolButton>
          ) : (
            <ToolButton label="Add link" onClick={() => setLinkDraft("")}>
              <Link2 className="size-4" />
            </ToolButton>
          )}
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border-strong" />
          <ToolButton label="Heading" active={marks.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-4" />
          </ToolButton>
          <ToolButton label="Quote" active={marks.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" />
          </ToolButton>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border-strong" />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const { from, to } = editor.state.selection;
              const text = editor.state.doc.textBetween(from, to, "\n").trim();
              if (text) {
                requestRewrite(text);
              }
            }}
            className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-caption font-semibold text-accent transition-colors hover:bg-accent-tint"
          >
            <Sparkles className="size-3.5" aria-hidden /> Rewrite
          </button>
        </>
      )}
    </BubbleMenu>
  );
}
