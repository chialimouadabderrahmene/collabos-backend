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
import { cn } from "@/lib/utils/cn";
import { useAssetMap } from "./asset-context";
import {
  assetIdFromRef,
  assetRef,
  isSafeHref,
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
}: {
  editor: Editor;
  opportunityId: string;
  canEdit: boolean;
  presentation: Presentation;
  onPresentationChange: (next: Presentation) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <BlockProperties editor={editor} opportunityId={opportunityId} canEdit={canEdit} />
      <PresentationSettings value={presentation} onChange={onPresentationChange} canEdit={canEdit} />
    </div>
  );
}
