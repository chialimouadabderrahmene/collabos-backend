"use client";

import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/field";
import { AssetPicker } from "@/features/assets/asset-picker";
import { evaluateSpecConfidence, type SpecFieldKey } from "@/features/opportunities/readiness";
import { cn } from "@/lib/utils/cn";
import { useAssetMap } from "./asset-context";
import {
  assetIdFromRef,
  assetRef,
  isSafeHref,
  type OpportunitySpec,
  type Presentation,
} from "./document-model";

/* ------------------------------------------------------------- shared */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-label text-muted uppercase">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1 rounded-md border border-border bg-surface p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded-sm text-caption font-semibold transition-colors disabled:cursor-not-allowed",
              value === option.value ? "bg-accent text-accent-ink" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border pb-5 last:border-b-0">
      <Eyebrow className="mb-3">{title}</Eyebrow>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Text input that commits on blur/Enter (one attribute update, one save). */
function CommitInput({
  label,
  value,
  onCommit,
  placeholder,
  multiline = false,
  validate,
  disabled,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  validate?: (value: string) => string | null;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  const commit = () => {
    const trimmed = draft.trim();
    const problem = validate?.(trimmed) ?? null;
    setError(problem);
    if (!problem && trimmed !== value) {
      onCommit(trimmed);
    }
  };

  return (
    <Field label={label} error={error ?? undefined}>
      {({ id, describedBy, invalid }) =>
        multiline ? (
          <Textarea
            id={id}
            rows={3}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
          />
        ) : (
          <Input
            id={id}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && commit()}
          />
        )
      }
    </Field>
  );
}

/* ------------------------------------------------------- selection */

interface Selected {
  type: string;
  attrs: Record<string, unknown>;
  headingLevel: number | null;
}

function readSelected(editor: Editor): Selected | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    return { type: selection.node.type.name, attrs: { ...selection.node.attrs }, headingLevel: null };
  }
  const parent = selection.$from.parent;
  if (parent.type.name === "heading") {
    return { type: "heading", attrs: {}, headingLevel: Number(parent.attrs.level) };
  }
  return null;
}

function BlockProperties({
  editor,
  opportunityId,
  canEdit,
}: {
  editor: Editor;
  opportunityId: string;
  canEdit: boolean;
}) {
  const selected = useEditorState({ editor, selector: ({ editor: current }) => readSelected(current) });
  const assets = useAssetMap();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!selected) {
    return (
      <Section title="Block">
        <p className="text-caption text-faint">
          Select an image, gallery, call-to-action or heading to edit its properties.
        </p>
      </Section>
    );
  }

  const update = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes(selected.type, attrs).run();

  if (selected.type === "heading") {
    return (
      <Section title="Heading">
        <Segmented
          label="Level"
          value={String(selected.headingLevel ?? 2) as "1" | "2" | "3"}
          disabled={!canEdit}
          options={[
            { value: "1", label: "Title" },
            { value: "2", label: "Heading" },
            { value: "3", label: "Sub" },
          ]}
          onChange={(level) =>
            editor.chain().focus().setHeading({ level: Number(level) as 1 | 2 | 3 }).run()
          }
        />
      </Section>
    );
  }

  if (selected.type === "assetImage") {
    const asset = assets.get(assetIdFromRef(selected.attrs.src) ?? "");
    return (
      <Section title="Image">
        {asset && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL thumbnail
          <img src={asset.url} alt="" className="aspect-video w-full rounded-md object-cover" />
        )}
        <Segmented
          label="Layout"
          value={(selected.attrs.layout as "wide" | "full" | "inline") ?? "wide"}
          disabled={!canEdit}
          options={[
            { value: "inline", label: "Inline" },
            { value: "wide", label: "Wide" },
            { value: "full", label: "Full bleed" },
          ]}
          onChange={(layout) => update({ layout })}
        />
        <CommitInput
          label="Alt text"
          value={String(selected.attrs.alt ?? "")}
          placeholder={asset?.altText ?? "Describe the image"}
          disabled={!canEdit}
          onCommit={(alt) => update({ alt })}
        />
        <CommitInput
          label="Caption"
          value={String(selected.attrs.caption ?? "")}
          placeholder="Optional caption"
          disabled={!canEdit}
          onCommit={(caption) => update({ caption })}
        />
      </Section>
    );
  }

  if (selected.type === "gallery") {
    const items = Array.isArray(selected.attrs.items) ? (selected.attrs.items as string[]) : [];
    const move = (index: number, delta: number) => {
      const next = [...items];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      update({ items: next });
    };
    return (
      <Section title="Gallery">
        <Segmented
          label="Columns"
          value={String(selected.attrs.columns ?? 2) as "2" | "3"}
          disabled={!canEdit}
          options={[
            { value: "2", label: "2 columns" },
            { value: "3", label: "3 columns" },
          ]}
          onChange={(columns) => update({ columns: Number(columns) })}
        />
        <div>
          <p className="mb-1.5 text-label text-muted uppercase">Images</p>
          <ul className="flex flex-col gap-1.5">
            {items.map((ref, index) => {
              const asset = assets.get(assetIdFromRef(ref) ?? "");
              return (
                <li key={`${ref}-${index}`} className="flex items-center gap-2 rounded-md border border-border bg-surface p-1.5">
                  {asset ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL thumbnail
                    <img src={asset.url} alt="" className="size-9 rounded-sm object-cover" />
                  ) : (
                    <span className="size-9 rounded-sm border border-dashed border-border-strong" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-caption text-fg-2">
                    {asset?.originalFilename ?? "Missing asset"}
                  </span>
                  <button type="button" aria-label="Move up" disabled={!canEdit || index === 0} onClick={() => move(index, -1)} className="rounded-sm p-1 text-muted hover:text-fg disabled:opacity-30">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" aria-label="Move down" disabled={!canEdit || index === items.length - 1} onClick={() => move(index, 1)} className="rounded-sm p-1 text-muted hover:text-fg disabled:opacity-30">
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" aria-label="Remove from gallery" disabled={!canEdit} onClick={() => update({ items: items.filter((_, i) => i !== index) })} className="rounded-sm p-1 text-muted hover:text-danger disabled:opacity-30">
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setPickerOpen(true)}>
              <ImagePlus className="size-3.5" aria-hidden /> Add images
            </Button>
          )}
        </div>
        <CommitInput
          label="Caption"
          value={String(selected.attrs.caption ?? "")}
          disabled={!canEdit}
          onCommit={(caption) => update({ caption })}
        />
        <AssetPicker
          opportunityId={opportunityId}
          open={pickerOpen}
          multiple
          onOpenChange={setPickerOpen}
          onConfirm={(picked) => update({ items: [...items, ...picked.map((asset) => assetRef(asset.id))] })}
        />
      </Section>
    );
  }

  if (selected.type === "ctaSection") {
    return (
      <Section title="Call to action">
        <CommitInput label="Heading" value={String(selected.attrs.heading ?? "")} placeholder="Ready to collaborate?" disabled={!canEdit} onCommit={(heading) => update({ heading })} />
        <CommitInput label="Body" multiline value={String(selected.attrs.body ?? "")} disabled={!canEdit} onCommit={(body) => update({ body })} />
        <CommitInput label="Button label" value={String(selected.attrs.label ?? "")} disabled={!canEdit} onCommit={(label) => update({ label: label || "Get in touch" })} />
        <CommitInput
          label="Link"
          value={String(selected.attrs.href ?? "")}
          placeholder="https://… or mailto:…"
          disabled={!canEdit}
          validate={(value) =>
            !value || isSafeHref(value) ? null : "Use an https:// or mailto: link"
          }
          onCommit={(href) => update({ href })}
        />
      </Section>
    );
  }

  return (
    <Section title="Block">
      <p className="text-caption text-faint">This block has no extra properties.</p>
    </Section>
  );
}

/* --------------------------------------------------- specification */

/** Joins/splits a short list as one line per item — the simplest possible
 * editor for "what needs to be produced", matching the plain-text spirit of
 * the rest of the R1 fields (see docs/adr/0008-opportunity-spec.md). */
function deliverablesToText(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}
function textToDeliverables(text: string): string[] | undefined {
  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
  return items.length > 0 ? items : undefined;
}

/** R2 — human-readable labels for SpecFieldKey, matching the field labels
 * above exactly so a "missing" mention points at the field the user
 * actually sees. Purely a UI concern — the pure check in readiness.ts only
 * ever deals in the stable keys. */
const SPEC_FIELD_LABELS: Record<SpecFieldKey, string> = {
  intent: "Why this exists",
  collaborator: "Who you're looking for",
  objective: "What you're trying to achieve",
  deliverables: "What needs to be produced",
  timeline: "Timing",
  budget: "Budget",
  constraints: "Constraints",
  successCriteria: "How you'll know it worked",
};

/** R2 — explains what's missing, never judges the opportunity. No score, no
 * progress bar: just a plain sentence and, when incomplete, the specific
 * fields — the same language the fields above already use. */
export function ConfidenceNote({ spec }: { spec: OpportunitySpec }) {
  const { complete, missing } = evaluateSpecConfidence(spec);

  if (complete) {
    return <p className="text-caption text-faint">Ready for confidence.</p>;
  }

  return (
    <div className="text-caption text-faint">
      <p>Needs a few details:</p>
      <ul className="mt-1 list-inside list-disc">
        {missing.map((key) => (
          <li key={key}>{SPEC_FIELD_LABELS[key]}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * R1 — the founder's instinct and the deal's specificity, captured
 * alongside the editorial document rather than instead of it. Every field
 * is optional and saves independently (one field, one commit) through the
 * same opportunity-update path `Publication` below already uses — nothing
 * here touches the document draft/autosave flow.
 */
export function SpecificationSection({
  spec,
  onChange,
  canEdit,
}: {
  spec: OpportunitySpec;
  onChange: (next: OpportunitySpec) => void;
  canEdit: boolean;
}) {
  const set = <K extends keyof OpportunitySpec>(key: K, value: OpportunitySpec[K]) =>
    onChange({ ...spec, [key]: value });

  return (
    <Section title="Specification">
      <ConfidenceNote spec={spec} />
      <CommitInput
        label="Why this exists"
        multiline
        value={spec.intent ?? ""}
        placeholder="The instinct behind this opportunity — what triggered it, what you're exploring"
        disabled={!canEdit}
        onCommit={(value) => set("intent", value || undefined)}
      />
      <CommitInput
        label="Who you're looking for"
        value={spec.collaborator?.type ?? ""}
        placeholder="e.g. photographer, ceramicist, production partner"
        disabled={!canEdit}
        onCommit={(value) =>
          set(
            "collaborator",
            value || spec.collaborator?.notes
              ? { ...spec.collaborator, type: value || undefined }
              : undefined,
          )
        }
      />
      <CommitInput
        label="What makes them the right fit"
        multiline
        value={spec.collaborator?.notes ?? ""}
        disabled={!canEdit}
        onCommit={(value) =>
          set(
            "collaborator",
            value || spec.collaborator?.type
              ? { ...spec.collaborator, notes: value || undefined }
              : undefined,
          )
        }
      />
      <CommitInput
        label="What you're trying to achieve"
        multiline
        value={spec.objective ?? ""}
        disabled={!canEdit}
        onCommit={(value) => set("objective", value || undefined)}
      />
      <CommitInput
        label="What needs to be produced"
        multiline
        value={deliverablesToText(spec.deliverables)}
        placeholder={"One per line, e.g.\n10 edited photos\n3 short reels"}
        disabled={!canEdit}
        onCommit={(value) => set("deliverables", textToDeliverables(value))}
      />
      <CommitInput
        label="Timing"
        value={spec.timeline ?? ""}
        placeholder="Deadline, duration, key dates — whatever's actually known"
        disabled={!canEdit}
        onCommit={(value) => set("timeline", value || undefined)}
      />
      <CommitInput
        label="Budget"
        value={spec.budget ?? ""}
        placeholder="A range, a cap, or a note that it's still open"
        disabled={!canEdit}
        onCommit={(value) => set("budget", value || undefined)}
      />
      <CommitInput
        label="Constraints"
        multiline
        value={spec.constraints ?? ""}
        placeholder="Known limitations, requirements or boundaries"
        disabled={!canEdit}
        onCommit={(value) => set("constraints", value || undefined)}
      />
      <CommitInput
        label="How you'll know it worked"
        multiline
        value={spec.successCriteria ?? ""}
        disabled={!canEdit}
        onCommit={(value) => set("successCriteria", value || undefined)}
      />
    </Section>
  );
}

/* ---------------------------------------------------- presentation */

function PresentationSettings({
  value,
  onChange,
  canEdit,
}: {
  value: Presentation;
  onChange: (next: Presentation) => void;
  canEdit: boolean;
}) {
  return (
    <Section title="Publication">
      <Segmented
        label="Typography"
        value={value.typography}
        disabled={!canEdit}
        options={[
          { value: "grotesk", label: "Grotesk" },
          { value: "editorial", label: "Editorial" },
        ]}
        onChange={(typography) => onChange({ ...value, typography })}
      />
      <Segmented
        label="Layout"
        value={value.layout}
        disabled={!canEdit}
        options={[
          { value: "narrow", label: "Narrow" },
          { value: "standard", label: "Standard" },
          { value: "wide", label: "Wide" },
        ]}
        onChange={(layout) => onChange({ ...value, layout })}
      />
      <Segmented
        label="Spacing"
        value={value.spacing}
        disabled={!canEdit}
        options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Regular" },
          { value: "airy", label: "Airy" },
        ]}
        onChange={(spacing) => onChange({ ...value, spacing })}
      />
      <Segmented
        label="Style"
        value={value.style}
        disabled={!canEdit}
        options={[
          { value: "noir", label: "Noir" },
          { value: "lime", label: "Lime" },
          { value: "mono", label: "Mono" },
        ]}
        onChange={(style) => onChange({ ...value, style })}
      />
    </Section>
  );
}

export function PropertiesPanel({
  editor,
  opportunityId,
  canEdit,
  presentation,
  onPresentationChange,
  spec,
  onSpecChange,
}: {
  editor: Editor;
  opportunityId: string;
  canEdit: boolean;
  presentation: Presentation;
  onPresentationChange: (next: Presentation) => void;
  spec: OpportunitySpec;
  onSpecChange: (next: OpportunitySpec) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <BlockProperties editor={editor} opportunityId={opportunityId} canEdit={canEdit} />
      <SpecificationSection spec={spec} onChange={onSpecChange} canEdit={canEdit} />
      <PresentationSettings value={presentation} onChange={onPresentationChange} canEdit={canEdit} />
    </div>
  );
}
