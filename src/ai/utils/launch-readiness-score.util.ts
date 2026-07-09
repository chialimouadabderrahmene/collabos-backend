import { DropStatus } from '@prisma/client';

export interface LaunchReadinessInput {
  status: DropStatus;
  publishAt: Date | null;
  hasPage: boolean;
  hasSeo: boolean;
  mediaCount: number;
  productCount: number;
}

export interface LaunchReadinessScore {
  score: number;
  blockers: string[];
}

const CHECKLIST_WEIGHT = 100 / 6;

export function computeLaunchReadiness(
  input: LaunchReadinessInput,
): LaunchReadinessScore {
  const blockers: string[] = [];
  let score = 0;

  if (input.hasPage) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('Drop page has not been created');
  }

  if (input.hasSeo) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('SEO metadata is missing');
  }

  if (input.mediaCount > 0) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('No media has been uploaded');
  }

  if (input.productCount > 0) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('No products are attached');
  }

  if (input.publishAt !== null) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('No publish date is scheduled');
  }

  if (input.status !== DropStatus.DRAFT) {
    score += CHECKLIST_WEIGHT;
  } else {
    blockers.push('Drop is still in draft status');
  }

  return { score: Math.round(score), blockers };
}
