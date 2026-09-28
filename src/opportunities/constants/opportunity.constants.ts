/** Structured-document formats the backend accepts. The backend stores the
 * editor's JSON as-is and never interprets it beyond generic safety checks,
 * so adding an editor is a one-line change here. */
export const DOCUMENT_FORMATS = [
  'tiptap',
  'prosemirror',
  'lexical',
  'slate',
  'blocks',
] as const;

export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

/** Format of a freshly created, never-edited draft. Not accepted on save and
 * cannot be published. */
export const BLANK_DOCUMENT_FORMAT = 'blank';

export const DOCUMENT_LIMITS = {
  maxBytes: 1_000_000,
  maxDepth: 64,
  maxNodes: 50_000,
  maxStringLength: 100_000,
  maxKeysPerObject: 200,
} as const;

export const METADATA_LIMITS = {
  maxBytes: 32_000,
  maxDepth: 8,
  maxNodes: 2_000,
  maxStringLength: 5_000,
  maxKeysPerObject: 100,
} as const;

/** Keys whose string values are treated as links/sources and restricted to
 * safe URL schemes (or `asset:` references). */
export const URL_LIKE_KEYS = new Set(['href', 'src', 'url', 'link', 'poster']);

export const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Document reference to an OpportunityAsset: `asset:<uuid>`. */
export const ASSET_REFERENCE_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const SHARE_LINK_MAX_TTL_DAYS = 365;

export const OPPORTUNITY_AGGREGATE_TYPE = 'Opportunity';
