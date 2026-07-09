import { DropStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeLaunchReadiness } from './launch-readiness-score.util';

describe('computeLaunchReadiness', () => {
  it('scores 100 with no blockers when every checklist item is satisfied', () => {
    const result = computeLaunchReadiness({
      status: DropStatus.SCHEDULED,
      publishAt: new Date(),
      hasPage: true,
      hasSeo: true,
      mediaCount: 3,
      productCount: 2,
    });

    expect(result).toEqual({ score: 100, blockers: [] });
  });

  it('scores 0 with every blocker when nothing is satisfied', () => {
    const result = computeLaunchReadiness({
      status: DropStatus.DRAFT,
      publishAt: null,
      hasPage: false,
      hasSeo: false,
      mediaCount: 0,
      productCount: 0,
    });

    expect(result.score).toBe(0);
    expect(result.blockers).toHaveLength(6);
  });

  it('flags only the missing checklist items', () => {
    const result = computeLaunchReadiness({
      status: DropStatus.SCHEDULED,
      publishAt: new Date(),
      hasPage: true,
      hasSeo: false,
      mediaCount: 0,
      productCount: 2,
    });

    expect(result.blockers).toEqual([
      'SEO metadata is missing',
      'No media has been uploaded',
    ]);
  });
});
