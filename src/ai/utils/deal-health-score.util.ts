import { DealStatus } from '@prisma/client';

export interface DealHealthScoreInput {
  status: DealStatus;
  endDate: Date | null;
  milestones: { dueDate: Date | null; isCompleted: boolean }[];
}

export interface DealHealthScore {
  score: number;
  riskFactors: string[];
}

export function computeDealHealthScore(
  input: DealHealthScoreInput,
  now: Date = new Date(),
): DealHealthScore {
  if (input.status === DealStatus.CANCELLED) {
    return { score: 0, riskFactors: ['Deal is cancelled'] };
  }

  if (input.status === DealStatus.COMPLETED) {
    return { score: 100, riskFactors: [] };
  }

  const riskFactors: string[] = [];
  let score = 100;

  if (input.endDate && input.endDate.getTime() < now.getTime()) {
    score -= 40;
    riskFactors.push('Deal end date has passed');
  }

  const overdueMilestones = input.milestones.filter(
    (milestone) =>
      !milestone.isCompleted &&
      milestone.dueDate !== null &&
      milestone.dueDate.getTime() < now.getTime(),
  ).length;

  if (overdueMilestones > 0) {
    score -= Math.min(40, overdueMilestones * 15);
    riskFactors.push(`${overdueMilestones} milestone(s) overdue`);
  }

  if (input.milestones.length === 0) {
    score -= 10;
    riskFactors.push('No milestones defined');
  } else {
    const completedRatio =
      input.milestones.filter((milestone) => milestone.isCompleted).length /
      input.milestones.length;
    score -= Math.round((1 - completedRatio) * 10);
  }

  return { score: Math.max(0, Math.min(100, score)), riskFactors };
}
