import { describe, expect, it } from 'vitest';
import { METADATA_LIMITS } from '../constants/opportunity.constants';
import {
  canonicalJson,
  DocumentValidationError,
  extractPlainText,
  validateJsonTree,
} from './document.util';

const ASSET_A = '11111111-1111-4111-8111-111111111111';
const ASSET_B = '22222222-2222-4222-8222-222222222222';

function tiptapDoc(...content: unknown[]) {
  return { type: 'doc', content };
}

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error('expected validation to fail');
}

describe('validateJsonTree', () => {
  it('accepts a typical Tiptap document and collects asset references', () => {
    const doc = tiptapDoc(
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'AW27' }],
      },
      { type: 'image', attrs: { src: `asset:${ASSET_A}`, alt: 'Sketch' } },
      { type: 'gallery', attrs: { assetId: ASSET_B } },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'See lookbook',
            marks: [
              { type: 'link', attrs: { href: 'https://collabos.io/lookbook' } },
            ],
          },
        ],
      },
    );

    const report = validateJsonTree(doc);

    expect(report.assetIds.sort()).toEqual([ASSET_A, ASSET_B]);
  });

  it('accepts a Lexical-shaped document (editor agnostic)', () => {
    const lexical = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Hello', format: 0 }],
          },
        ],
      },
    };

    expect(validateJsonTree(lexical).assetIds).toEqual([]);
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox',
    '//evil.example.com/x',
    'not a url',
  ])('rejects unsafe link value %s', (href) => {
    const doc = tiptapDoc({
      type: 'text',
      text: 'x',
      marks: [{ type: 'link', attrs: { href } }],
    });

    expect(issuesOf(() => validateJsonTree(doc))[0]).toMatch(/unsafe URL/);
  });

  it('allows anchors and mailto links', () => {
    const doc = tiptapDoc(
      {
        type: 'text',
        marks: [{ type: 'link', attrs: { href: '#section-2' } }],
      },
      {
        type: 'text',
        marks: [{ type: 'link', attrs: { href: 'mailto:hi@brand.com' } }],
      },
    );

    expect(() => validateJsonTree(doc)).not.toThrow();
  });

  it('rejects prototype-polluting keys', () => {
    const polluted = JSON.parse(
      '{"type":"doc","__proto__":{"admin":true}}',
    ) as unknown;

    expect(issuesOf(() => validateJsonTree(polluted))[0]).toMatch(
      /forbidden key/,
    );
  });

  it('rejects malformed asset IDs', () => {
    const doc = tiptapDoc({
      type: 'image',
      attrs: { assetId: '../../etc/passwd' },
    });

    expect(issuesOf(() => validateJsonTree(doc))[0]).toMatch(/assetId/);
  });

  it('enforces the size limit', () => {
    const doc = { text: 'x'.repeat(METADATA_LIMITS.maxBytes) };

    expect(issuesOf(() => validateJsonTree(doc, METADATA_LIMITS))[0]).toMatch(
      /exceeds/,
    );
  });

  it('enforces the depth limit', () => {
    let deep: Record<string, unknown> = { text: 'leaf' };
    for (let i = 0; i < 80; i += 1) {
      deep = { content: [deep] };
    }

    expect(issuesOf(() => validateJsonTree(deep)).join(' ')).toMatch(/nesting/);
  });

  it('enforces the string length limit', () => {
    const doc = { text: 'y'.repeat(METADATA_LIMITS.maxStringLength + 1) };

    expect(
      issuesOf(() =>
        validateJsonTree(doc, { ...METADATA_LIMITS, maxBytes: 1e6 }),
      )[0],
    ).toMatch(/string longer/);
  });
});

describe('canonicalJson', () => {
  it('is independent of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [1, 2] }, b: 1 }),
    );
  });
});

describe('extractPlainText', () => {
  it('collects text leaves in document order', () => {
    const doc = tiptapDoc(
      { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Body   copy' }] },
    );

    expect(extractPlainText(doc)).toBe('Title Body copy');
  });

  it('caps the output length', () => {
    const doc = tiptapDoc({ type: 'text', text: 'z'.repeat(100) });

    expect(extractPlainText(doc, 10)).toHaveLength(10);
  });
});
