"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { filterBlocks, insertBlock, type BlockDefinition } from "./blocks";

interface SlashState {
  open: boolean;
  query: string;
  /** Document range of the typed "/query" text. */
  from: number;
  to: number;
}

const CLOSED: SlashState = { open: false, query: "", from: 0, to: 0 };

function readSlash(editor: Editor): SlashState {
  const { selection } = editor.state;
  if (!selection.empty) {
    return CLOSED;
  }
  const { $from } = selection;
  const parent = $from.parent;
  if (parent.type.name !== "paragraph") {
    return CLOSED;
  }
  const text = parent.textContent;
  const offset = $from.parentOffset;
  // Only when "/" starts the paragraph and the cursor is at its end.
  if (!text.startsWith("/") || offset !== text.length || /\s/.test(text)) {
    return CLOSED;
  }
  const start = $from.start();
  return { open: true, query: text.slice(1), from: start, to: start + text.length };
}

/** "/" command palette for inserting blocks at the cursor. */
export function SlashMenu({
  editor,
  onRequestAsset,
}: {
  editor: Editor;
  /** Image/gallery blocks open the asset picker instead of inserting directly. */
  onRequestAsset: (block: BlockDefinition) => void;
}) {
  const slash = useEditorState({ editor, selector: ({ editor: current }) => readSlash(current) });
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const items = slash.open ? filterBlocks(slash.query) : [];
  const visible = slash.open && items.length > 0 && dismissedAt !== slash.from;

  // Reset the highlighted item whenever the typed query changes.
  const [lastQuery, setLastQuery] = useState(slash.query);
  if (slash.query !== lastQuery) {
    setLastQuery(slash.query);
    setActive(0);
  }

  const choose = (block: BlockDefinition) => {
    editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
    if (block.needsAsset) {
      onRequestAsset(block);
    } else {
      insertBlock(editor, block.id);
    }
  };

  // Keyboard handling while open (captured before ProseMirror sees it).
  useEffect(() => {
    if (!visible) {
      return;
    }
    const dom = editor.view.dom;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (index + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (index - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const block = items[active];
        if (block) {
          choose(block);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        setDismissedAt(slash.from);
      }
    };
    dom.addEventListener("keydown", onKeyDown, true);
    return () => dom.removeEventListener("keydown", onKeyDown, true);
  });

  if (!visible || typeof document === "undefined") {
    return null;
  }

  const coords = editor.view.coordsAtPos(slash.to);
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insert block"
      style={{ top: coords.bottom + 6, left: coords.left }}
      className="fixed z-50 max-h-80 w-64 animate-fade-in overflow-y-auto rounded-md border border-border-strong bg-surface-2 p-1 shadow-2xl shadow-black/60"
    >
      <p className="px-2.5 pt-1.5 pb-1 text-label text-faint uppercase">Blocks</p>
      {items.map((block, index) => {
        const Icon = block.icon;
        return (
          <button
            key={block.id}
            type="button"
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(block)}
            className={cn(
              "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left transition-colors",
              index === active ? "bg-surface-3" : "hover:bg-surface-3",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-body font-semibold text-fg">{block.label}</span>
              <span className="block truncate text-caption text-muted">{block.description}</span>
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
