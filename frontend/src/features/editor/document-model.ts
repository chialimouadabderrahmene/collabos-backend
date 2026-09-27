/**
 * The CollabOS structured document model (Tiptap/ProseMirror JSON), shared by
 * the Studio editor and every read-only renderer (preview, versions, share).
 *
 * Assets are referenced as `asset:<uuid>` — never by URL. Signed URLs expire
 * and are resolved at render time from the asset list returned by the API.
 */

export const DOCUMENT_FORMAT = "tiptap" as const;
export const DOCUMENT_SCHEMA_VERSION = 1;

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

export const ASSET_REF_PREFIX = "asset:";

export function assetRef(assetId: string): string {
  return `${ASSET_REF_PREFIX}${assetId}`;
}

export function assetIdFromRef(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(ASSET_REF_PREFIX)
    ? value.slice(ASSET_REF_PREFIX.length)
    : null;
}

export function emptyDocument(): DocNode {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function isDocNode(value: unknown): value is DocNode {
  return typeof value === "object" && value !== null && typeof (value as DocNode).type === "string";
}

/** Every asset id referenced by a document, in document order. */
export function collectAssetIds(root: unknown): string[] {
  const ids: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "string") {
      const id = assetIdFromRef(value);
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(root);
  return ids;
}

/** Plain text of a document (for readiness checks and word counts). */
export function plainText(root: unknown): string {
  const parts: string[] = [];
  const visit = (node: unknown) => {
    if (!isDocNode(node)) {
      return;
    }
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }
    node.content?.forEach(visit);
  };
  visit(root);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function countNodes(root: unknown, type: string): number {
  let count = 0;
  const visit = (node: unknown) => {
    if (!isDocNode(node)) {
      return;
    }
    if (node.type === type) {
      count += 1;
    }
    node.content?.forEach(visit);
  };
  visit(root);
  return count;
}

/** Only these link targets are rendered (mirrors backend URL validation). */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.trim() === "") {
    return false;
  }
  if (href.startsWith("#")) {
    return true;
  }
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------ presentation */

export type TypographyStyle = "grotesk" | "editorial";
export type LayoutWidth = "narrow" | "standard" | "wide";
export type SpacingDensity = "compact" | "comfortable" | "airy";
export type ColourStyle = "noir" | "lime" | "mono";

/** Publication styling, stored in `Opportunity.metadata.presentation` and
 * snapshotted with every published version. */
export interface Presentation {
  typography: TypographyStyle;
  layout: LayoutWidth;
  spacing: SpacingDensity;
  style: ColourStyle;
}

export const DEFAULT_PRESENTATION: Presentation = {
  typography: "grotesk",
  layout: "standard",
  spacing: "comfortable",
  style: "noir",
};

export function readPresentation(metadata: unknown): Presentation {
  const raw =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).presentation
      : undefined;
  if (!raw || typeof raw !== "object") {
    return DEFAULT_PRESENTATION;
  }
  const value = raw as Record<string, unknown>;
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value[key] as T) ? (value[key] as T) : fallback;
  return {
    typography: pick("typography", ["grotesk", "editorial"], DEFAULT_PRESENTATION.typography),
    layout: pick("layout", ["narrow", "standard", "wide"], DEFAULT_PRESENTATION.layout),
    spacing: pick("spacing", ["compact", "comfortable", "airy"], DEFAULT_PRESENTATION.spacing),
    style: pick("style", ["noir", "lime", "mono"], DEFAULT_PRESENTATION.style),
  };
}

/**
 * R1 — structured Opportunity specification (INSTINCT + SPECIFICITY),
 * stored in `Opportunity.metadata.spec` alongside `presentation` above. The
 * backend (`OpportunityDocumentService`) is the source of truth for
 * validation — this reader is deliberately lenient (never throws), the same
 * way `readPresentation` is: a malformed or absent value just reads back as
 * "nothing set" so an opportunity created before R1, or with unrelated
 * metadata only, still renders normally. See docs/adr/0008-opportunity-spec.md.
 */
export interface OpportunitySpec {
  intent?: string;
  collaborator?: { type?: string; notes?: string };
  objective?: string;
  deliverables?: string[];
  timeline?: string;
  budget?: string;
  constraints?: string;
  successCriteria?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function readOpportunitySpec(metadata: unknown): OpportunitySpec {
  const raw =
    metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).spec : undefined;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const value = raw as Record<string, unknown>;
  const collaboratorRaw = value.collaborator;
  const collaborator =
    collaboratorRaw && typeof collaboratorRaw === "object"
      ? {
          type: readString((collaboratorRaw as Record<string, unknown>).type),
          notes: readString((collaboratorRaw as Record<string, unknown>).notes),
        }
      : undefined;

  return {
    intent: readString(value.intent),
    collaborator:
      collaborator && (collaborator.type || collaborator.notes) ? collaborator : undefined,
    objective: readString(value.objective),
    deliverables: Array.isArray(value.deliverables)
      ? value.deliverables.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined,
    timeline: readString(value.timeline),
    budget: readString(value.budget),
    constraints: readString(value.constraints),
    successCriteria: readString(value.successCriteria),
  };
}

/** True when nothing has been filled in yet — used to decide whether to show
 * an empty-state hint instead of a wall of blank fields. */
export function isEmptyOpportunitySpec(spec: OpportunitySpec): boolean {
  return (
    !spec.intent &&
    !spec.collaborator &&
    !spec.objective &&
    !spec.deliverables?.length &&
    !spec.timeline &&
    !spec.budget &&
    !spec.constraints &&
    !spec.successCriteria
  );
}
