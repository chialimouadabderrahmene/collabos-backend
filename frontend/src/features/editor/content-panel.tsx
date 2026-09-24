"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Eyebrow } from "@/components/ui/display";
import { cn } from "@/lib/utils/cn";
import { BLOCKS, insertBlockAfterCurrent, moveBlock, type BlockDefinition } from "./blocks";

/** Left "Content" panel: block palette + current-block ordering actions. */
export function ContentPanel({
  editor,
  canEdit,
  onRequestAsset,
}: {
  editor: Editor;
  canEdit: boolean;
  onRequestAsset: (block: BlockDefinition) => void;
}) {
  const position = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const index = current.state.selection.$from.index(0);
      return { index, count: current.state.doc.childCount };
    },
  });

  const add = (block: BlockDefinition) => {
    if (!canEdit) {
      return;
    }
    if (block.needsAsset) {
      onRequestAsset(block);
      return;
    }
    insertBlockAfterCurrent(editor, block.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-3">Add block</Eyebrow>
        <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {BLOCKS.map((block) => {
            const Icon = block.icon;
            return (
              <li key={block.id}>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => add(block)}
                  className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-muted transition-colors group-hover:border-accent-line group-hover:text-accent">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="text-caption font-semibold text-fg-2 group-hover:text-fg">
                    {block.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[0.6875rem] text-faint">
          Tip: type <kbd className="rounded-sm border border-border bg-surface-2 px-1 font-mono text-fg-2">/</kbd> on
          an empty line.
        </p>
      </div>

      <div>
        <Eyebrow className="mb-3">Current block</Eyebrow>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            {
              label: "Move up",
              icon: ArrowUp,
              disabled: position.index <= 0,
              run: () => moveBlock(editor, "up"),
            },
            {
              label: "Move down",
              icon: ArrowDown,
              disabled: position.index >= position.count - 1,
              run: () => moveBlock(editor, "down"),
            },
            {
              label: "Delete",
              icon: Trash2,
              disabled: position.count <= 1,
              run: () => {
                const { state } = editor;
                const index = state.selection.$from.index(0);
                let start = 0;
                for (let i = 0; i < index; i += 1) {
                  start += state.doc.child(i).nodeSize;
                }
                editor
                  .chain()
                  .focus()
                  .deleteRange({ from: start, to: start + state.doc.child(index).nodeSize })
                  .run();
              },
            },
          ].map(({ label, icon: Icon, disabled, run }) => (
            <button
              key={label}
              type="button"
              disabled={!canEdit || disabled}
              onClick={run}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface text-[0.6875rem] font-semibold transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-35",
                label === "Delete" ? "text-danger" : "text-fg-2",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
