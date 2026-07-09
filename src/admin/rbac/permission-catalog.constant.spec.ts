import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG } from './permission-catalog.constant';

describe('PERMISSION_CATALOG', () => {
  it('contains only unique permission names', () => {
    expect(new Set(PERMISSION_CATALOG).size).toBe(PERMISSION_CATALOG.length);
  });

  it('includes the events:replay permission enforced on the outbox controller', () => {
    expect(PERMISSION_CATALOG).toContain('events:replay');
  });
});
