import { describe, expect, it } from 'vitest';
import { evaluateSpecConfidence } from './opportunity-spec-confidence';

describe('evaluateSpecConfidence (R5 backend mirror of frontend R2)', () => {
  it('an empty spec is missing every field, in stable order', () => {
    const { complete, missing } = evaluateSpecConfidence({});
    expect(complete).toBe(false);
    expect(missing).toEqual([
      'intent',
      'collaborator',
      'objective',
      'deliverables',
      'timeline',
      'budget',
      'constraints',
      'successCriteria',
    ]);
  });

  it('a spec with everything filled is complete', () => {
    const { complete, missing } = evaluateSpecConfidence({
      intent: 'Explore a summer campaign',
      collaborator: { type: 'Photographer' },
      objective: 'Produce a lookbook',
      deliverables: ['10 photos'],
      timeline: 'July',
      budget: '€5,000',
      constraints: 'Milan only',
      successCriteria: '500 signups',
    });
    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });

  it('flags only objective as missing when every other field is filled', () => {
    const { missing } = evaluateSpecConfidence({
      intent: 'x',
      collaborator: { type: 'Photographer' },
      deliverables: ['10 photos'],
      timeline: 'July',
      budget: '€5,000',
      constraints: 'Milan only',
      successCriteria: '500 signups',
    });
    expect(missing).toEqual(['objective']);
  });

  it('whitespace-only deliverables count as missing, not present', () => {
    const { missing } = evaluateSpecConfidence({
      deliverables: ['   ', ''],
    });
    expect(missing).toContain('deliverables');
  });

  it('an empty deliverables array counts as missing', () => {
    const { missing } = evaluateSpecConfidence({ deliverables: [] });
    expect(missing).toContain('deliverables');
  });

  it('collaborator.notes alone (without type) is enough to satisfy collaborator', () => {
    const { missing } = evaluateSpecConfidence({
      collaborator: { notes: 'Milan-based, resort/swim experience' },
    });
    expect(missing).not.toContain('collaborator');
  });
});
