"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { Presentation } from "./document-model";

/** Grows a textarea to fit its content (title/standfirst fields). */
function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [value]);
  return ref;
}

/**
 * The editorial canvas: headline and standfirst (Opportunity title/summary)
 * above the structured document, styled like the published page.
 */
export function StudioCanvas({
  editor,
  title,
  summary,
  canEdit,
  presentation,
  onTitleChange,
  onSummaryChange,
}: {
  editor: Editor;
  title: string;
  summary: string;
  canEdit: boolean;
  presentation: Presentation;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(title);
  const [summaryDraft, setSummaryDraft] = useState(summary);
  // Adopt server values when they change (e.g. an AI suggestion was applied)
  // — React's "adjust state when a prop changes" pattern, no effect needed.
  const [syncedTitle, setSyncedTitle] = useState(title);
  const [syncedSummary, setSyncedSummary] = useState(summary);
  if (title !== syncedTitle) {
    setSyncedTitle(title);
    setTitleDraft(title);
  }
  if (summary !== syncedSummary) {
    setSyncedSummary(summary);
    setSummaryDraft(summary);
  }
  const titleRef = useAutoGrow(titleDraft);
  const summaryRef = useAutoGrow(summaryDraft);

  const width = { narrow: "max-w-[38rem]", standard: "max-w-[44rem]", wide: "max-w-[52rem]" }[
    presentation.layout
  ];

  return (
    <div className={cn("mx-auto w-full px-5 pt-10 pb-40 sm:px-8 lg:pt-14", width)}>
      <label htmlFor="studio-title" className="sr-only">
        Title
      </label>
      <textarea
        id="studio-title"
        ref={titleRef}
        rows={1}
        value={titleDraft}
        readOnly={!canEdit}
        maxLength={160}
        placeholder="Untitled Opportunity"
        onChange={(event) => setTitleDraft(event.target.value.replace(/\n/g, " "))}
        onBlur={() => titleDraft.trim() && titleDraft.trim() !== title && onTitleChange(titleDraft.trim())}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            editor.commands.focus("start");
          }
        }}
        className={cn(
          "w-full resize-none overflow-hidden bg-transparent font-display text-[2.25rem] leading-[1.05] font-bold tracking-[-0.025em] text-fg placeholder:text-faint focus:outline-none sm:text-[3rem]",
          presentation.typography === "editorial" && "uppercase tracking-[0.01em]",
        )}
      />
      <label htmlFor="studio-summary" className="sr-only">
        Summary
      </label>
      <textarea
        id="studio-summary"
        ref={summaryRef}
        rows={1}
        value={summaryDraft}
        readOnly={!canEdit}
        maxLength={2000}
        placeholder="Add a standfirst — one or two sentences that set the scene."
        onChange={(event) => setSummaryDraft(event.target.value)}
        onBlur={() => summaryDraft.trim() !== summary && onSummaryChange(summaryDraft.trim())}
        className="mt-5 w-full resize-none overflow-hidden bg-transparent text-lg leading-relaxed text-muted placeholder:text-faint focus:outline-none sm:text-xl"
      />
      <div aria-hidden className="my-8 h-px bg-border" />
      <EditorContent editor={editor} className="studio-prose" />
    </div>
  );
}
