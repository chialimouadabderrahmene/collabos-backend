import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  LayoutGrid,
  List,
  ListOrdered,
  type LucideIcon,
  Megaphone,
  Minus,
  Quote,
  Type,
} from "lucide-react";

export type BlockId =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "image"
  | "gallery"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "divider"
  | "cta";

export interface BlockDefinition {
  id: BlockId;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  /** Blocks that need an asset are inserted through the asset picker. */
  needsAsset?: boolean;
}

export const BLOCKS: BlockDefinition[] = [
  { id: "paragraph", label: "Text", description: "Body copy", icon: Type, keywords: ["text", "paragraph", "p"] },
  { id: "heading1", label: "Title", description: "Section title", icon: Heading1, keywords: ["h1", "title", "heading"] },
  { id: "heading2", label: "Heading", description: "Section heading", icon: Heading2, keywords: ["h2", "heading", "subtitle"] },
  { id: "heading3", label: "Subheading", description: "Accent subheading", icon: Heading3, keywords: ["h3", "subheading"] },
  { id: "image", label: "Image", description: "Sketch, look or reference", icon: ImageIcon, keywords: ["image", "photo", "sketch", "picture"], needsAsset: true },
  { id: "gallery", label: "Gallery", description: "Grid of images", icon: LayoutGrid, keywords: ["gallery", "grid", "lookbook"], needsAsset: true },
  { id: "quote", label: "Quote", description: "Pull quote", icon: Quote, keywords: ["quote", "blockquote"] },
  { id: "bulletList", label: "Bulleted list", description: "Unordered list", icon: List, keywords: ["list", "bullet", "ul"] },
  { id: "orderedList", label: "Numbered list", description: "Ordered steps", icon: ListOrdered, keywords: ["list", "numbered", "ol"] },
  { id: "divider", label: "Divider", description: "Section break", icon: Minus, keywords: ["divider", "hr", "rule", "separator"] },
  { id: "cta", label: "Call to action", description: "Invite a response", icon: Megaphone, keywords: ["cta", "button", "contact", "apply"] },
];

export function filterBlocks(query: string): BlockDefinition[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return BLOCKS;
  }
  return BLOCKS.filter(
    (block) =>
      block.label.toLowerCase().includes(term) ||
      block.keywords.some((keyword) => keyword.startsWith(term)),
  );
}

/** Inserts (or converts the current empty block into) the given block. */
export function insertBlock(
  editor: Editor,
  id: BlockId,
  options: { assetRefs?: string[] } = {},
): boolean {
  const chain = editor.chain().focus();
  switch (id) {
    case "paragraph":
      return chain.setParagraph().run();
    case "heading1":
      return chain.setHeading({ level: 1 }).run();
    case "heading2":
      return chain.setHeading({ level: 2 }).run();
    case "heading3":
      return chain.setHeading({ level: 3 }).run();
    case "quote":
      return chain.setParagraph().toggleBlockquote().run();
    case "bulletList":
      return chain.setParagraph().toggleBulletList().run();
    case "orderedList":
      return chain.setParagraph().toggleOrderedList().run();
    case "divider":
      return chain.insertContent([{ type: "horizontalRule" }, { type: "paragraph" }]).run();
    case "cta":
      return chain
        .insertContent([
          { type: "ctaSection", attrs: { heading: "", body: "", label: "Get in touch", href: "" } },
          { type: "paragraph" },
        ])
        .run();
    case "image": {
      const [src] = options.assetRefs ?? [];
      return src
        ? chain
            .insertContent([
              { type: "assetImage", attrs: { src, alt: "", caption: "", layout: "wide" } },
              { type: "paragraph" },
            ])
            .run()
        : false;
    }
    case "gallery": {
      const items = options.assetRefs ?? [];
      return items.length > 0
        ? chain
            .insertContent([
              { type: "gallery", attrs: { items, columns: items.length >= 3 ? 3 : 2, caption: "" } },
              { type: "paragraph" },
            ])
            .run()
        : false;
    }
    default:
      return false;
  }
}

/**
 * Adds a block *after* the current top-level block (panel/asset actions).
 * An empty paragraph is reused in place, so repeated adds never transform
 * content the user already wrote.
 */
export function insertBlockAfterCurrent(
  editor: Editor,
  id: BlockId,
  options: { assetRefs?: string[] } = {},
): boolean {
  const { state } = editor;
  const index = state.selection.$from.index(0);
  const current = state.doc.maybeChild(index);
  const reuse = current?.type.name === "paragraph" && current.content.size === 0;
  if (current && !reuse) {
    let end = 0;
    for (let i = 0; i <= index; i += 1) {
      end += state.doc.child(i).nodeSize;
    }
    editor
      .chain()
      .insertContentAt(end, { type: "paragraph" })
      .setTextSelection(end + 1)
      .run();
  }
  return insertBlock(editor, id, options);
}

/** Moves the top-level block containing the selection up or down by one. */
export function moveBlock(editor: Editor, direction: "up" | "down"): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  if ($from.depth === 0 && state.selection.from === 0) {
    return false;
  }
  // Top-level index of the block containing the selection.
  const index = state.selection.$from.index(0);
  const doc = state.doc;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= doc.childCount) {
    return false;
  }

  const current = doc.child(index);
  let start = 0;
  for (let i = 0; i < index; i += 1) {
    start += doc.child(i).nodeSize;
  }
  const end = start + current.nodeSize;

  const tr = state.tr.delete(start, end);
  let insertAt = 0;
  const after = tr.doc;
  for (let i = 0; i < target; i += 1) {
    insertAt += after.child(i).nodeSize;
  }
  tr.insert(insertAt, current);
  view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
  // Place the cursor back inside the moved block.
  editor.commands.setTextSelection(Math.min(insertAt + 1, editor.state.doc.content.size));
  return true;
}
