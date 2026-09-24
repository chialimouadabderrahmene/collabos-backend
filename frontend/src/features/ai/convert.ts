import type { GenerateCopyOutput, StructureBlock } from "@/lib/api/ai";
import type { DocNode } from "@/features/editor/document-model";

function text(value: string): DocNode[] {
  const trimmed = value.trim();
  return trimmed ? [{ type: "text", text: trimmed }] : [];
}

/** Splits multi-paragraph AI text on blank lines into paragraphs. */
export function paragraphs(value: string): DocNode[] {
  return value
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((chunk) => ({ type: "paragraph", content: text(chunk) }));
}

/** AI "generate copy" sections → heading + paragraphs per section. */
export function sectionsToNodes(output: GenerateCopyOutput): DocNode[] {
  return output.sections.flatMap((section) => [
    ...(section.heading.trim()
      ? [{ type: "heading", attrs: { level: 2 }, content: text(section.heading) }]
      : []),
    ...paragraphs(section.body),
  ]);
}

/**
 * AI "structure" blocks → editor nodes. Image blocks become an italic
 * placeholder line (the AI cannot pick assets); the user replaces it with a
 * real image from the asset library.
 */
export function structureToNodes(blocks: StructureBlock[]): DocNode[] {
  const nodes: DocNode[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        if (block.text?.trim()) {
          const level = block.level && block.level >= 1 && block.level <= 3 ? block.level : 2;
          nodes.push({ type: "heading", attrs: { level }, content: text(block.text) });
        }
        break;
      case "paragraph":
        if (block.text) {
          nodes.push(...paragraphs(block.text));
        }
        break;
      case "quote":
        if (block.text?.trim()) {
          nodes.push({ type: "blockquote", content: [{ type: "paragraph", content: text(block.text) }] });
        }
        break;
      case "list": {
        const items = (block.items ?? []).map((item) => item.trim()).filter(Boolean);
        if (items.length > 0) {
          nodes.push({
            type: "bulletList",
            content: items.map((item) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: text(item) }],
            })),
          });
        }
        break;
      }
      case "image":
        nodes.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `[Image: ${block.caption?.trim() || "add a visual here"}]`,
              marks: [{ type: "italic" }],
            },
          ],
        });
        break;
      default:
        break;
    }
  }
  return nodes;
}
