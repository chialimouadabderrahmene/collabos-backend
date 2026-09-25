import { createHash } from 'node:crypto';
import {
  ALLOWED_URL_SCHEMES,
  ASSET_REFERENCE_PATTERN,
  DOCUMENT_LIMITS,
  URL_LIKE_KEYS,
} from '../constants/opportunity.constants';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface JsonTreeLimits {
  maxBytes: number;
  maxDepth: number;
  maxNodes: number;
  maxStringLength: number;
  maxKeysPerObject: number;
}

export interface JsonTreeReport {
  /** Distinct OpportunityAsset IDs referenced by the tree. */
  assetIds: string[];
}

export class DocumentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid document: ${issues.join('; ')}`);
  }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_REPORTED_ISSUES = 10;

export function isPlainObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Editor-agnostic safety validation of a JSON tree (Tiptap, ProseMirror,
 * Lexical, Slate all produce plain JSON). It does not interpret the editor
 * schema; it enforces:
 * - size, depth, node-count, string-length and key-count limits;
 * - no prototype-polluting keys, no non-finite numbers;
 * - link/source values (`href`, `src`, ...) restricted to http(s)/mailto,
 *   in-page anchors, or `asset:<uuid>` references (blocks `javascript:`,
 *   `data:`, `vbscript:` and protocol-relative URLs);
 * - collects every referenced asset ID (`asset:<uuid>` strings and
 *   `assetId` attributes) so callers can verify ownership.
 * Rendering-time HTML sanitization remains the frontend's responsibility;
 * the backend never renders this content to HTML.
 */
export function validateJsonTree(
  root: unknown,
  limits: JsonTreeLimits = DOCUMENT_LIMITS,
): JsonTreeReport {
  const issues: string[] = [];
  const assetIds = new Set<string>();

  const serialized = JSON.stringify(root);
  if (serialized === undefined) {
    throw new DocumentValidationError(['content must be JSON']);
  }
  if (Buffer.byteLength(serialized, 'utf8') > limits.maxBytes) {
    throw new DocumentValidationError([
      `content exceeds ${limits.maxBytes} bytes`,
    ]);
  }

  let nodes = 0;
  const stack: Array<{
    value: unknown;
    path: string;
    depth: number;
    key?: string;
  }> = [{ value: root, path: '$', depth: 0 }];

  while (stack.length > 0 && issues.length < MAX_REPORTED_ISSUES) {
    const { value, path, depth, key } = stack.pop()!;

    nodes += 1;
    if (nodes > limits.maxNodes) {
      issues.push(`content exceeds ${limits.maxNodes} nodes`);
      break;
    }
    if (depth > limits.maxDepth) {
      issues.push(`${path}: nesting deeper than ${limits.maxDepth}`);
      continue;
    }

    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) {
        issues.push(`${path}: string longer than ${limits.maxStringLength}`);
        continue;
      }
      const assetMatch = ASSET_REFERENCE_PATTERN.exec(value);
      if (assetMatch) {
        assetIds.add(assetMatch[1].toLowerCase());
      } else if (key === 'assetId') {
        issues.push(`${path}: assetId must be "asset:<uuid>" or a uuid`);
      } else if (key && URL_LIKE_KEYS.has(key) && !isSafeUrl(value)) {
        issues.push(`${path}: unsupported or unsafe URL`);
      }
      continue;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        issues.push(`${path}: numbers must be finite`);
      }
      continue;
    }

    if (typeof value === 'boolean' || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        stack.push({
          value: item,
          path: `${path}[${index}]`,
          depth: depth + 1,
        }),
      );
      continue;
    }

    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      if (keys.length > limits.maxKeysPerObject) {
        issues.push(`${path}: more than ${limits.maxKeysPerObject} keys`);
        continue;
      }
      for (const childKey of keys) {
        if (FORBIDDEN_KEYS.has(childKey)) {
          issues.push(`${path}: forbidden key "${childKey}"`);
          continue;
        }
        const child = value[childKey];
        if (
          childKey === 'assetId' &&
          typeof child === 'string' &&
          isUuid(child)
        ) {
          assetIds.add(child.toLowerCase());
          continue;
        }
        stack.push({
          value: child,
          path: `${path}.${childKey}`,
          depth: depth + 1,
          key: childKey,
        });
      }
      continue;
    }

    issues.push(`${path}: unsupported value`);
  }

  if (issues.length > 0) {
    throw new DocumentValidationError(issues);
  }

  return { assetIds: [...assetIds] };
}

function isUuid(value: string): boolean {
  return ASSET_REFERENCE_PATTERN.test(`asset:${value}`);
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('#')) {
    return true;
  }
  if (trimmed.startsWith('//')) {
    return false;
  }
  try {
    return ALLOWED_URL_SCHEMES.has(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

/** Deterministic JSON (object keys sorted) so equal snapshots hash equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Collects the human-readable text of an editor document (every `text`
 * string, in document order), used as AI context. Editor-agnostic: Tiptap,
 * ProseMirror, Lexical and Slate all store text leaves under `text`. */
export function extractPlainText(root: unknown, maxLength = 12_000): string {
  const parts: string[] = [];
  let length = 0;

  const visit = (value: unknown): void => {
    if (length >= maxLength) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'text' && typeof child === 'string') {
          parts.push(child);
          length += child.length + 1;
        } else {
          visit(child);
        }
      }
    }
  };

  visit(root);
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
