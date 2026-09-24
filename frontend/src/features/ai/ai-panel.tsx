"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  Check,
  LayoutList,
  PenLine,
  Sparkles,
  Type,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useStudioStore } from "@/features/editor/studio-store";
import { aiApi, type AiSuggestion } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { paragraphs, sectionsToNodes, structureToNodes } from "./convert";

type Action = "generate" | "rewrite" | "summarize" | "structure" | "titles";

const ACTIONS: Array<{ id: Action; label: string; hint: string; icon: LucideIcon }> = [
  { id: "generate", label: "Generate copy", hint: "Draft editorial copy from your brief", icon: WandSparkles },
  { id: "structure", label: "Generate structure", hint: "Turn notes into a layout", icon: LayoutList },
  { id: "rewrite", label: "Rewrite", hint: "Refine a passage", icon: PenLine },
  { id: "summarize", label: "Summarize", hint: "Write a standfirst", icon: AlignLeft },
  { id: "titles", label: "Titles", hint: "Title & description ideas", icon: Type },
];

export interface AiApplyHandlers {
  /** Inserts nodes at the cursor (through the editor, so autosave applies). */
  insertNodes: (nodes: ReturnType<typeof paragraphs>) => void;
  /** Replaces the current selection with plain text, if it still exists. */
  replaceSelection: (text: string) => boolean;
  /** Updates the Opportunity title/summary (PATCH). */
  applyMeta: (input: { title?: string; summary?: string }) => Promise<void>;
}

function describeError(error: unknown): { title: string; description?: string; disabled?: boolean } {
  if (error instanceof ApiError) {
    if (error.isUnavailable) {
      return {
        title: "AI assistance isn't configured",
        description: "An administrator needs to connect an AI provider for this workspace.",
        disabled: true,
      };
    }
    if (error.isRateLimited) {
      return { title: "Too many AI requests", description: "Please wait a minute and try again." };
    }
    if (error.status === 502) {
      return { title: "The AI provider didn't respond", description: "Try again in a moment." };
    }
    return { title: "AI request failed", description: error.message };
  }
  return { title: "AI request failed" };
}

/* ------------------------------------------------------ suggestion */

function ApplyButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" onClick={onClick}>
      <Check className="size-3.5" aria-hidden /> {children}
    </Button>
  );
}

function SuggestionCard({
  suggestion,
  handlers,
  onResolved,
}: {
  suggestion: AiSuggestion;
  handlers: AiApplyHandlers;
  onResolved: (id: string, status: "ACCEPTED" | "DISCARDED") => void;
}) {
  const [busy, setBusy] = useState(false);

  /** Apply locally first; record acceptance only after it worked. */
  const accept = async (apply: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await apply();
      onResolved(suggestion.id, "ACCEPTED");
    } catch (error) {
      toast.error("Couldn't apply the suggestion", error instanceof ApiError ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode = null;
  let actions: ReactNode = null;

  switch (suggestion.kind) {
    case "GENERATE_COPY": {
      const output = suggestion.output;
      body = (
        <>
          <p className="font-display text-heading text-fg">{output.title}</p>
          <p className="mt-1 text-caption text-muted">{output.summary}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {output.sections.map((section, index) => (
              <li key={index}>
                <p className="text-caption font-bold text-fg">{section.heading}</p>
                <p className="line-clamp-4 text-caption text-fg-2">{section.body}</p>
              </li>
            ))}
          </ul>
        </>
      );
      actions = (
        <>
          <ApplyButton onClick={() => accept(() => handlers.insertNodes(sectionsToNodes(output)))}>
            Insert sections
          </ApplyButton>
          <Button size="sm" variant="secondary" onClick={() => accept(() => handlers.applyMeta({ title: output.title, summary: output.summary }))}>
            Use title & summary
          </Button>
        </>
      );
      break;
    }
    case "STRUCTURE": {
      const output = suggestion.output;
      body = (
        <>
          <p className="font-display text-heading text-fg">{output.title}</p>
          <p className="mt-1 text-caption text-muted">{output.summary}</p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {output.blocks.map((block, index) => (
              <li key={index} className="flex gap-2 text-caption">
                <Badge tone="neutral" className="shrink-0">{block.type}</Badge>
                <span className="line-clamp-2 text-fg-2">
                  {block.text ?? block.caption ?? block.items?.join(" · ") ?? ""}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
      actions = (
        <>
          <ApplyButton onClick={() => accept(() => handlers.insertNodes(structureToNodes(output.blocks)))}>
            Insert structure
          </ApplyButton>
          <Button size="sm" variant="secondary" onClick={() => accept(() => handlers.applyMeta({ title: output.title, summary: output.summary }))}>
            Use title & summary
          </Button>
        </>
      );
      break;
    }
    case "REWRITE": {
      const output = suggestion.output;
      body = <p className="text-body whitespace-pre-line text-fg-2">{output.text}</p>;
      actions = (
        <>
          <ApplyButton
            onClick={() =>
              accept(() => {
                if (!handlers.replaceSelection(output.text)) {
                  handlers.insertNodes(paragraphs(output.text));
                  toast.info("Your selection changed", "The rewrite was inserted at the cursor instead.");
                }
              })
            }
          >
            Replace selection
          </ApplyButton>
          <Button size="sm" variant="secondary" onClick={() => accept(() => handlers.insertNodes(paragraphs(output.text)))}>
            Insert below
          </Button>
        </>
      );
      break;
    }
    case "SUMMARIZE": {
      const output = suggestion.output;
      body = <p className="text-body text-fg-2">{output.summary}</p>;
      actions = (
        <ApplyButton onClick={() => accept(() => handlers.applyMeta({ summary: output.summary }))}>
          Use as summary
        </ApplyButton>
      );
      break;
    }
    case "TITLES": {
      const output = suggestion.output;
      body = (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5">
            {output.titles.map((title) => (
              <li key={title} className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface-2 p-2">
                <span className="text-body font-semibold text-fg">{title}</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => accept(() => handlers.applyMeta({ title }))}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1.5">
            {output.summaries.map((summary) => (
              <li key={summary} className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface-2 p-2">
                <span className="text-caption text-fg-2">{summary}</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => accept(() => handlers.applyMeta({ summary }))}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      );
      break;
    }
  }

  return (
    <Card className="animate-slide-up p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge tone="accent">
          <Sparkles className="size-3" aria-hidden /> Suggestion
        </Badge>
        <span className="text-[0.625rem] text-faint">{suggestion.model}</span>
      </div>
      {body}
      <div className={cn("mt-4 flex flex-wrap gap-2", busy && "pointer-events-none opacity-60")}>
        {actions}
        <Button size="sm" variant="ghost" onClick={() => onResolved(suggestion.id, "DISCARDED")}>
          <X className="size-3.5" aria-hidden /> Discard
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- request */

function RequestForm({
  action,
  prefillText,
  disabled,
  loading,
  onSubmit,
}: {
  action: Action;
  prefillText: string;
  disabled: boolean;
  loading: boolean;
  onSubmit: (input: { text: string; tone: string; instruction: string }) => void;
}) {
  const [text, setText] = useState(prefillText);
  const [tone, setTone] = useState("");
  const [instruction, setInstruction] = useState("");
  const [syncedPrefill, setSyncedPrefill] = useState(prefillText);
  if (prefillText !== syncedPrefill) {
    setSyncedPrefill(prefillText);
    setText(prefillText);
  }

  const needsText = action === "generate" || action === "rewrite" || action === "structure";
  const labels: Record<Action, string> = {
    generate: "Your brief",
    rewrite: "Text to rewrite",
    structure: "Your notes",
    summarize: "",
    titles: "",
  };
  const placeholders: Record<Action, string> = {
    generate: "A knitwear capsule with an Italian atelier. We're looking for…",
    rewrite: "Select text in the editor, or paste it here",
    structure: "Paste notes, bullet points, references…",
    summarize: "",
    titles: "",
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ text: text.trim(), tone: tone.trim(), instruction: instruction.trim() });
      }}
      className="flex flex-col gap-3"
    >
      {needsText && (
        <Field label={labels[action]}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={5}
              value={text}
              maxLength={action === "structure" ? 12000 : action === "rewrite" ? 8000 : 4000}
              disabled={disabled}
              placeholder={placeholders[action]}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </Field>
      )}
      {action === "rewrite" && (
        <Field label="Instruction" optional>
          {({ id }) => (
            <Input id={id} value={instruction} disabled={disabled} placeholder="More concise and evocative" maxLength={1000} onChange={(event) => setInstruction(event.target.value)} />
          )}
        </Field>
      )}
      {(action === "generate" || action === "rewrite") && (
        <Field label="Tone" optional>
          {({ id }) => (
            <Input id={id} value={tone} disabled={disabled} placeholder="quiet luxury, editorial" maxLength={100} onChange={(event) => setTone(event.target.value)} />
          )}
        </Field>
      )}
      {!needsText && (
        <p className="text-caption text-muted">
          {action === "summarize"
            ? "Summarizes the current draft into a standfirst."
            : "Proposes titles and descriptions from the current draft."}
        </p>
      )}
      <Button type="submit" loading={loading} disabled={disabled || (needsText && !text.trim())}>
        <Sparkles className="size-4" aria-hidden /> Generate suggestion
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------- panel */

export function AiPanel({
  opportunityId,
  canEdit,
  handlers,
}: {
  opportunityId: string;
  canEdit: boolean;
  handlers: AiApplyHandlers;
}) {
  const client = useQueryClient();
  const prefill = useStudioStore((state) => state.aiPrefill);
  const clearPrefill = useStudioStore((state) => state.clearAiPrefill);
  const [action, setAction] = useState<Action>("generate");
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null);

  // A "Rewrite" request from the floating toolbar switches the action.
  const [seenPrefill, setSeenPrefill] = useState(prefill);
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill?.action === "rewrite") {
      setAction("rewrite");
    }
  }

  const pending = useQuery({
    queryKey: queryKeys.opportunities.suggestions(opportunityId),
    queryFn: () => aiApi.list(opportunityId, "PENDING"),
    select: (page) => page.data,
  });

  const request = useMutation({
    mutationFn: (input: { text: string; tone: string; instruction: string }) => {
      const tone = input.tone || undefined;
      switch (action) {
        case "generate":
          return aiApi.generate(opportunityId, { instructions: input.text, tone });
        case "rewrite":
          return aiApi.rewrite(opportunityId, { text: input.text, instruction: input.instruction || undefined, tone });
        case "structure":
          return aiApi.structure(opportunityId, { notes: input.text });
        case "summarize":
          return aiApi.summarize(opportunityId);
        case "titles":
          return aiApi.titles(opportunityId);
      }
    },
    onMutate: () => setError(null),
    onSuccess: () => {
      clearPrefill();
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.suggestions(opportunityId) });
    },
    onError: (failure) => {
      const described = describeError(failure);
      setError(described);
      if (described.disabled) {
        setUnavailable(true);
      }
    },
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACCEPTED" | "DISCARDED" }) =>
      status === "ACCEPTED" ? aiApi.accept(opportunityId, id) : aiApi.discard(opportunityId, id),
    onSettled: () =>
      client.invalidateQueries({ queryKey: queryKeys.opportunities.suggestions(opportunityId) }),
  });

  const disabled = !canEdit || unavailable;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow className="mb-2">AI assistant</Eyebrow>
        <p className="text-caption text-muted">
          Suggestions never change your document until you apply them.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="AI action">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={action === id}
            onClick={() => setAction(id)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-caption font-semibold transition-colors",
              action === id
                ? "border-accent-line bg-accent-tint text-accent"
                : "border-border bg-surface text-fg-2 hover:border-border-strong",
              id === "generate" && "col-span-2",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <RequestForm
        key={action}
        action={action}
        prefillText={action === "rewrite" ? (prefill?.text ?? "") : ""}
        disabled={disabled}
        loading={request.isPending}
        onSubmit={(input) => request.mutate(input)}
      />

      {request.isPending && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-accent-line/60 bg-accent-tint/40 p-4">
          <span className="inline-flex items-center gap-2 text-caption font-semibold text-accent">
            <Sparkles className="size-3.5 animate-pulse" aria-hidden /> Writing a suggestion…
          </span>
          <div className="skeleton h-3 w-11/12 rounded-sm" />
          <div className="skeleton h-3 w-9/12 rounded-sm" />
          <div className="skeleton h-3 w-10/12 rounded-sm" />
        </div>
      )}

      {error && (
        <div role="alert" className={cn("rounded-md border p-3", error.disabled ? "border-warning/30 bg-warning-tint" : "border-danger/25 bg-danger-tint")}>
          <p className={cn("text-caption font-semibold", error.disabled ? "text-warning" : "text-danger")}>{error.title}</p>
          {error.description && <p className="mt-0.5 text-caption text-fg-2">{error.description}</p>}
        </div>
      )}

      {pending.data && pending.data.length > 0 && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Pending suggestions</Eyebrow>
          {pending.data.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              handlers={handlers}
              onResolved={(id, status) => resolve.mutate({ id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
