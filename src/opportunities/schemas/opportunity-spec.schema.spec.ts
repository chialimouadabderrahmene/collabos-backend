import { describe, expect, it } from 'vitest';
import { validateOpportunitySpec } from './opportunity-spec.schema';

describe('validateOpportunitySpec', () => {
  it('accepts a complete specification', () => {
    const result = validateOpportunitySpec({
      intent: 'Explore a collaboration around a summer campaign',
      collaborator: { type: 'photographer', notes: 'Editorial, natural light' },
      objective: 'Produce a lookbook for the AW27 drop',
      deliverables: ['10 edited photos', '3 behind-the-scenes reels'],
      timeline: 'Shoot in October, delivery by December',
      budget: '€5,000–8,000',
      constraints: 'Must be shot on location in Milan',
      successCriteria: 'Lookbook drives at least 500 waitlist signups',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.intent).toContain('summer campaign');
      expect(result.spec.deliverables).toHaveLength(2);
    }
  });

  it('accepts a partial specification (a single field is enough)', () => {
    const result = validateOpportunitySpec({
      intent: 'Explore a collaboration around a summer campaign',
    });

    expect(result.ok).toBe(true);
  });

  it('accepts an empty specification', () => {
    expect(validateOpportunitySpec({}).ok).toBe(true);
  });

  it('rejects a non-object value', () => {
    expect(validateOpportunitySpec('not an object').ok).toBe(false);
    expect(validateOpportunitySpec(null).ok).toBe(false);
    expect(validateOpportunitySpec(['array']).ok).toBe(false);
  });

  it('rejects wrong field types', () => {
    const result = validateOpportunitySpec({ intent: 12345 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe('intent');
    }
  });

  it('rejects deliverables that are not an array of strings', () => {
    const result = validateOpportunitySpec({ deliverables: 'one big string' });
    expect(result.ok).toBe(false);
  });

  it('rejects more than 20 deliverables', () => {
    const result = validateOpportunitySpec({
      deliverables: Array.from({ length: 21 }, (_, i) => `item ${i}`),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown top-level key (no over-collection of arbitrary data)', () => {
    const result = validateOpportunitySpec({
      intent: 'ok',
      randomField: 'nope',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown collaborator key', () => {
    const result = validateOpportunitySpec({
      collaborator: { role: 'photographer' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty-string field (use undefined to omit instead)', () => {
    const result = validateOpportunitySpec({ objective: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects a field over its max length', () => {
    const result = validateOpportunitySpec({ intent: 'x'.repeat(4001) });
    expect(result.ok).toBe(false);
  });

  it('trims whitespace from string fields', () => {
    const result = validateOpportunitySpec({
      objective: '  Produce a lookbook  ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.objective).toBe('Produce a lookbook');
    }
  });
});
