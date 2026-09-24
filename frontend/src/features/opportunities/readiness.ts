import {
  collectAssetIds,
  countNodes,
  isDocNode,
  plainText,
  type DocNode,
} from "@/features/editor/document-model";
import type { Asset, Draft, Opportunity } from "@/lib/api/opportunities";

export type CheckStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  id: "content" | "assets" | "alt-text" | "metadata" | "links" | "sharing";
  label: string;
  status: CheckStatus;
  detail: string;
}

function ctasWithoutLink(root: unknown): number {
  let count = 0;
  const visit = (node: unknown) => {
    if (!isDocNode(node)) {
      return;
    }
    if (node.type === "ctaSection" && !node.attrs?.href) {
      count += 1;
    }
    node.content?.forEach(visit);
  };
  visit(root);
  return count;
}

function imagesWithoutAlt(root: unknown, assets: Map<string, Asset>): number {
  let count = 0;
  const visit = (node: unknown) => {
    if (!isDocNode(node)) {
      return;
    }
    if (node.type === "assetImage") {
      const ref = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const asset = assets.get(ref.replace(/^asset:/, ""));
      if (!node.attrs?.alt && !asset?.altText) {
        count += 1;
      }
    }
    (node as DocNode).content?.forEach(visit);
  };
  visit(root);
  return count;
}

/**
 * Pre-publish checks. `fail` blocks publishing (the backend would reject it
 * too); `warn` is advisory. Pure function — unit tested.
 */
export function evaluateReadiness(
  opportunity: Opportunity,
  draft: Draft,
  assets: Asset[],
): ReadinessCheck[] {
  const blank = draft.format === "blank";
  const words = blank ? 0 : plainText(draft.content).split(/\s+/).filter(Boolean).length;
  const headings = blank ? 0 : countNodes(draft.content, "heading");
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const referenced = blank ? [] : collectAssetIds(draft.content);
  const missing = referenced.filter((id) => !byId.has(id));
  const noAlt = blank ? 0 : imagesWithoutAlt(draft.content, byId);
  const openCtas = blank ? 0 : ctasWithoutLink(draft.content);

  return [
    {
      id: "content",
      label: "Content",
      status: blank || words === 0 ? "fail" : words < 60 || headings === 0 ? "warn" : "pass",
      detail: blank || words === 0
        ? "The document is empty."
        : `${words} words · ${headings} heading${headings === 1 ? "" : "s"}${
            words < 60 ? " — consider adding more detail" : headings === 0 ? " — add a heading for structure" : ""
          }`,
    },
    {
      id: "assets",
      label: "Assets",
      status: missing.length > 0 ? "fail" : "pass",
      detail:
        missing.length > 0
          ? `${missing.length} referenced asset${missing.length === 1 ? " is" : "s are"} missing or deleted.`
          : referenced.length > 0
            ? `${referenced.length} asset${referenced.length === 1 ? "" : "s"} will be pinned to this version.`
            : "No images yet — publications are stronger with visuals.",
    },
    {
      id: "alt-text",
      label: "Accessibility",
      status: noAlt > 0 ? "warn" : "pass",
      detail: noAlt > 0 ? `${noAlt} image${noAlt === 1 ? " has" : "s have"} no alt text.` : "Every image has alt text.",
    },
    {
      id: "metadata",
      label: "Metadata",
      status: !opportunity.title.trim() ? "fail" : !opportunity.summary ? "warn" : "pass",
      detail: !opportunity.title.trim()
        ? "A title is required."
        : !opportunity.summary
          ? "No standfirst — recipients see only the title before reading."
          : "Title and standfirst are set.",
    },
    {
      id: "links",
      label: "Calls to action",
      status: openCtas > 0 ? "warn" : "pass",
      detail: openCtas > 0 ? `${openCtas} call-to-action block${openCtas === 1 ? " has" : "s have"} no link.` : "All calls to action have links.",
    },
    {
      id: "sharing",
      label: "Sharing",
      status: "pass",
      detail: "After publishing, create a private link pinned to this exact version.",
    },
  ];
}

export function canPublishWith(checks: ReadinessCheck[]): boolean {
  return checks.every((check) => check.status !== "fail");
}
