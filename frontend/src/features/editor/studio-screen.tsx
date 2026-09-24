"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, type Editor } from "@tiptap/react";
import {
  ArrowLeft,
  Eye,
  ImageIcon,
  Lock,
  Save,
  SlidersHorizontal,
  Sparkles,
  SquarePlus,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OpportunityStatusBadge } from "@/components/domain/opportunity-card";
import { Button, IconButton } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { AiPanel, type AiApplyHandlers } from "@/features/ai/ai-panel";
import { AssetPanel } from "@/features/assets/asset-panel";
import { AssetPicker } from "@/features/assets/asset-picker";
import { useAssets } from "@/features/assets/hooks";
import { useOpportunity, useUpdateOpportunity } from "@/features/opportunities/hooks";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi, type Asset, type Draft, type JsonDocument, type Opportunity } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { AssetProvider } from "./asset-context";
import { useDraftAutosave } from "./autosave";
import { insertBlockAfterCurrent, type BlockDefinition } from "./blocks";
import { ConflictDialog } from "./conflict-dialog";
import { ContentPanel } from "./content-panel";
import { assetRef, emptyDocument, readPresentation, type Presentation } from "./document-model";
import { EditorStatus } from "./editor-status";
import { studioExtensions } from "./extensions";
import { FloatingToolbar } from "./floating-toolbar";
import { PropertiesPanel } from "./properties-panel";
import { SlashMenu } from "./slash-menu";
import { StudioCanvas } from "./studio-canvas";
import { useStudioStore, type LeftPanel, type MobileSheet, type RightPanel } from "./studio-store";

/* -------------------------------------------------------------- panels */

function PanelTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-5 border-b border-border px-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "-mb-px border-b-2 pt-3.5 pb-2.5 text-label uppercase transition-colors",
            value === option.value ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const LEFT_TABS: Array<{ value: LeftPanel; label: string }> = [
  { value: "content", label: "Content" },
  { value: "assets", label: "Assets" },
];
const RIGHT_TABS: Array<{ value: RightPanel; label: string }> = [
  { value: "properties", label: "Properties" },
  { value: "ai", label: "AI" },
];

const SHEET_TITLES: Record<Exclude<MobileSheet, null>, string> = {
  content: "Add content",
  assets: "Assets",
  properties: "Properties",
  ai: "AI assistant",
};

function MobileSheetFrame({
  sheet,
  onClose,
  children,
}: {
  sheet: MobileSheet;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={sheet !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in lg:hidden" />
        <DialogPrimitive.Content className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[78dvh] flex-col rounded-t-xl border-t border-border bg-surface data-[state=open]:animate-slide-up focus:outline-none lg:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="font-display text-heading">
              {sheet ? SHEET_TITLES[sheet] : ""}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Studio panel</DialogPrimitive.Description>
            <DialogPrimitive.Close aria-label="Close" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------------------------------------ studio */

interface StudioProps {
  opportunity: Opportunity;
  draft: Draft;
  assets: Asset[];
}

function Studio({ opportunity, draft, assets }: StudioProps) {
  const router = useRouter();
  const client = useQueryClient();
  const updateOpportunity = useUpdateOpportunity(opportunity.id);
  const { left, right, mobileSheet, setLeft, setRight, openSheet } = useStudioStore();
  const [picker, setPicker] = useState<BlockDefinition | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const capabilities = opportunity.capabilities;
  const archived = Boolean(opportunity.archivedAt);
  const canEdit = Boolean(capabilities?.edit) && !archived;
  const canPublish = Boolean(capabilities?.publish) && !archived;
  const presentation = readPresentation(opportunity.metadata);

  const initialContent = useMemo<JsonDocument>(
    () => (draft.format === "blank" ? (emptyDocument() as unknown as JsonDocument) : draft.content),
    // Only the first draft seeds the editor; later saves never reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getContent = useCallback(
    () => (editorRef.current?.getJSON() ?? initialContent) as JsonDocument,
    [initialContent],
  );
  const replaceContent = useCallback((content: JsonDocument) => {
    editorRef.current?.commands.setContent(content, { emitUpdate: false });
  }, []);
  const onSaved = useCallback(
    (saved: Draft) => client.setQueryData(queryKeys.opportunities.draft(opportunity.id), saved),
    [client, opportunity.id],
  );

  const autosave = useDraftAutosave({
    opportunityId: opportunity.id,
    initialRevision: draft.revision,
    getContent,
    replaceContent,
    enabled: canEdit,
    onSaved,
  });

  const editor = useEditor({
    extensions: studioExtensions(),
    content: initialContent,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Opportunity document",
        class: "focus:outline-none",
      },
    },
    onUpdate: () => autosave.markDirty(),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // ⌘/Ctrl + S saves immediately.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void autosave.flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autosave]);

  const saveMeta = async (input: { title?: string; summary?: string; metadata?: Record<string, unknown> }) => {
    try {
      await updateOpportunity.mutateAsync(input);
    } catch (error) {
      toast.error("Couldn't save", error instanceof ApiError ? error.message : undefined);
      throw error;
    }
  };

  const changePresentation = (next: Presentation) =>
    void saveMeta({ metadata: { ...opportunity.metadata, presentation: next } }).catch(() => undefined);

  const goTo = async (href: string) => {
    const saved = await autosave.flush();
    if (!saved) {
      toast.error("Save your changes first", "Resolve the save problem before continuing.");
      return;
    }
    router.push(href);
  };

  const insertAssets = (picked: Asset[], block: BlockDefinition) => {
    const current = editorRef.current;
    if (!current) {
      return;
    }
    insertBlockAfterCurrent(current, block.id, { assetRefs: picked.map((asset) => assetRef(asset.id)) });
  };

  const aiHandlers: AiApplyHandlers = {
    insertNodes: (nodes) => {
      editorRef.current?.chain().focus().insertContent(nodes).run();
    },
    replaceSelection: (text) => {
      const current = editorRef.current;
      if (!current || current.state.selection.empty) {
        return false;
      }
      return current.chain().focus().insertContent(text).run();
    },
    applyMeta: (input) => saveMeta(input),
  };

  if (!editor) {
    return <LoadingState label="Opening the Studio" className="min-h-dvh" />;
  }

  const leftContent =
    left === "content" ? (
      <ContentPanel editor={editor} canEdit={canEdit} onRequestAsset={setPicker} />
    ) : (
      <AssetPanel
        opportunityId={opportunity.id}
        canEdit={canEdit}
        onInsert={(asset) => insertAssets([asset], { id: "image" } as BlockDefinition)}
      />
    );

  const rightContent =
    right === "properties" ? (
      <PropertiesPanel
        editor={editor}
        opportunityId={opportunity.id}
        canEdit={canEdit}
        presentation={presentation}
        onPresentationChange={changePresentation}
      />
    ) : (
      <AiPanel opportunityId={opportunity.id} canEdit={canEdit} handlers={aiHandlers} />
    );

  const sheetContent = (() => {
    switch (mobileSheet) {
      case "content":
        return <ContentPanel editor={editor} canEdit={canEdit} onRequestAsset={(block) => { openSheet(null); setPicker(block); }} />;
      case "assets":
        return (
          <AssetPanel
            opportunityId={opportunity.id}
            canEdit={canEdit}
            onInsert={(asset) => {
              insertAssets([asset], { id: "image" } as BlockDefinition);
              openSheet(null);
            }}
          />
        );
      case "properties":
        return (
          <PropertiesPanel
            editor={editor}
            opportunityId={opportunity.id}
            canEdit={canEdit}
            presentation={presentation}
            onPresentationChange={changePresentation}
          />
        );
      case "ai":
        return <AiPanel opportunityId={opportunity.id} canEdit={canEdit} handlers={aiHandlers} />;
      default:
        return null;
    }
  })();

  return (
    <AssetProvider assets={assets}>
      <div className="flex h-dvh flex-col bg-bg">
        {/* ---------------------------------------------------- top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/95 px-3 backdrop-blur sm:px-4">
          <Link
            href={`/opportunities/${opportunity.id}`}
            aria-label="Back to opportunity"
            className="flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-display text-body font-bold text-fg">{opportunity.title}</p>
              <span className="hidden sm:inline-flex">
                <OpportunityStatusBadge status={opportunity.status} />
              </span>
            </div>
            {canEdit ? (
              <EditorStatus state={autosave.state} className="text-[0.6875rem]" />
            ) : (
              <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted">
                <Lock className="size-3" aria-hidden /> {archived ? "Archived — read only" : "View only"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <Tooltip content="Save now (⌘S)">
                <IconButton label="Save now" variant="ghost" onClick={() => void autosave.flush()}>
                  <Save className="size-4" />
                </IconButton>
              </Tooltip>
            )}
            <Button variant="secondary" size="sm" onClick={() => void goTo(`/opportunities/${opportunity.id}/preview`)}>
              <Eye className="size-4" aria-hidden /> <span className="hidden sm:inline">Preview</span>
            </Button>
            {canPublish ? (
              <Button size="sm" onClick={() => void goTo(`/opportunities/${opportunity.id}/publish`)}>
                <Upload className="size-4" aria-hidden /> Publish
              </Button>
            ) : (
              <Tooltip content="Only brand admins or the creator can publish">
                <span>
                  <Button size="sm" disabled>
                    <Upload className="size-4" aria-hidden /> Publish
                  </Button>
                </span>
              </Tooltip>
            )}
          </div>
        </header>

        {!canEdit && (
          <div className="shrink-0 border-b border-border bg-surface px-4 py-2 text-center text-caption text-muted">
            {archived
              ? "This opportunity is archived. Restore it to continue editing."
              : "You have view access. Ask a brand admin for edit access to make changes."}
          </div>
        )}

        {/* ---------------------------------------------------- body */}
        <div className="flex min-h-0 flex-1">
          <aside aria-label="Content and assets" className="hidden w-[272px] shrink-0 flex-col border-r border-border bg-surface/40 lg:flex">
            <PanelTabs value={left} options={LEFT_TABS} onChange={setLeft} />
            <div className="flex-1 overflow-y-auto p-4">{leftContent}</div>
          </aside>

          <main id="main" className="min-w-0 flex-1 overflow-y-auto">
            <StudioCanvas
              editor={editor}
              title={opportunity.title}
              summary={opportunity.summary ?? ""}
              canEdit={canEdit}
              presentation={presentation}
              onTitleChange={(title) => void saveMeta({ title }).catch(() => undefined)}
              onSummaryChange={(summary) => void saveMeta({ summary }).catch(() => undefined)}
            />
          </main>

          <aside aria-label="Properties and AI" className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-surface/40 lg:flex">
            <PanelTabs value={right} options={RIGHT_TABS} onChange={setRight} />
            <div className="flex-1 overflow-y-auto p-4">{rightContent}</div>
          </aside>
        </div>

        {/* ------------------------------------------------ mobile dock */}
        <nav aria-label="Studio tools" className="safe-bottom shrink-0 border-t border-border bg-bg/95 backdrop-blur lg:hidden">
          <ul className="mx-auto grid h-14 max-w-lg grid-cols-4">
            {[
              { sheet: "content" as const, label: "Blocks", icon: SquarePlus },
              { sheet: "assets" as const, label: "Assets", icon: ImageIcon },
              { sheet: "properties" as const, label: "Style", icon: SlidersHorizontal },
              { sheet: "ai" as const, label: "AI", icon: Sparkles },
            ].map(({ sheet, label, icon: Icon }) => (
              <li key={sheet} className="flex">
                <button
                  type="button"
                  onClick={() => openSheet(sheet)}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold transition-colors",
                    sheet === "ai" ? "text-accent" : "text-fg-2 hover:text-fg",
                  )}
                >
                  <Icon className="size-5" aria-hidden /> {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <MobileSheetFrame sheet={mobileSheet} onClose={() => openSheet(null)}>
          {sheetContent}
        </MobileSheetFrame>

        {canEdit && <FloatingToolbar editor={editor} />}
        {canEdit && <SlashMenu editor={editor} onRequestAsset={setPicker} />}

        <AssetPicker
          opportunityId={opportunity.id}
          open={picker !== null}
          multiple={picker?.id === "gallery"}
          onOpenChange={(open) => !open && setPicker(null)}
          onConfirm={(picked) => picker && insertAssets(picked, picker)}
        />

        {autosave.state.status === "conflict" && autosave.state.conflict && (
          <ConflictDialog
            conflict={autosave.state.conflict}
            localRevision={autosave.state.revision}
            getLocalContent={getContent}
            onReload={autosave.reloadLatest}
            onKeepMine={autosave.keepMine}
          />
        )}
      </div>
    </AssetProvider>
  );
}

/* ------------------------------------------------------------ loader */

export function StudioScreen({ opportunityId }: { opportunityId: string }) {
  const opportunity = useOpportunity(opportunityId);
  const draft = useQuery({
    queryKey: queryKeys.opportunities.draft(opportunityId),
    queryFn: () => opportunitiesApi.getDraft(opportunityId),
    // The editor owns the document once open; never refetch underneath it.
    staleTime: Infinity,
    refetchOnMount: "always",
  });
  const assets = useAssets(opportunityId);

  const failed = opportunity.error ?? draft.error;
  if (failed) {
    const notFound = failed instanceof ApiError && failed.isNotFound;
    return (
      <div className="mx-auto max-w-md px-6 pt-24">
        <ErrorState
          title={notFound ? "Opportunity not found" : "Couldn't open the Studio"}
          description={notFound ? "It doesn't exist or you don't have access to it." : undefined}
          onRetry={notFound ? undefined : () => void Promise.all([opportunity.refetch(), draft.refetch()])}
        />
        <div className="mt-6 text-center">
          <Link href="/opportunities" className="text-caption font-semibold text-accent">
            Back to Opportunities
          </Link>
        </div>
      </div>
    );
  }

  if (!opportunity.data || !draft.data) {
    return <LoadingState label="Opening the Studio" className="min-h-dvh" />;
  }

  return <Studio opportunity={opportunity.data} draft={draft.data} assets={assets.data ?? []} />;
}
