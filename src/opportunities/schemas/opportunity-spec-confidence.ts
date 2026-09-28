import { OpportunitySpec } from './opportunity-spec.schema';

/**
 * R5 — backend mirror of the frontend's R2 `evaluateSpecConfidence`
 * (collabos-ui/frontend/src/features/opportunities/readiness.ts). R2 itself
 * stays frontend-only by design; this is a separate, identical, pure copy
 * used only to ground R5's AI gap-finding in the same deterministic rule —
 * it is not a new "backend R2" and nothing here is exposed as readiness or
 * scoring. Same field order, same "whitespace-only counts as missing" rule.
 */
export type SpecFieldKey =
  | 'intent'
  | 'collaborator'
  | 'objective'
  | 'deliverables'
  | 'timeline'
  | 'budget'
  | 'constraints'
  | 'successCriteria';

export interface SpecConfidence {
  complete: boolean;
  missing: SpecFieldKey[];
}

export const SPEC_FIELD_ORDER: SpecFieldKey[] = [
  'intent',
  'collaborator',
  'objective',
  'deliverables',
  'timeline',
  'budget',
  'constraints',
  'successCriteria',
];

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function evaluateSpecConfidence(spec: OpportunitySpec): SpecConfidence {
  const missing = SPEC_FIELD_ORDER.filter((key) => {
    switch (key) {
      case 'collaborator':
        return (
          !hasText(spec.collaborator?.type) &&
          !hasText(spec.collaborator?.notes)
        );
      case 'deliverables':
        return !(spec.deliverables ?? []).some((item) => hasText(item));
      default:
        return !hasText(spec[key]);
    }
  });

  return { complete: missing.length === 0, missing };
}
