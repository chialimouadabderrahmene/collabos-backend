import { DealStatus } from '@prisma/client';
import { DealHealth } from '../types/deal-response.types';

interface DealHealthInput {
  status: DealStatus;
  endDate: Date | null;
}

interface MilestoneHealthInput {
  dueDate: Date | null;
  isCompleted: boolean;
}

export function computeDealHealth(
  deal: DealHealthInput,
  milestones: MilestoneHealthInput[],
): DealHealth {
  if (deal.status === DealStatus.CANCELLED) {
    return 'CANCELLED';
  }

  if (deal.status === DealStatus.COMPLETED) {
    return 'COMPLETED';
  }

  const now = Date.now();

  if (deal.endDate && deal.endDate.getTime() < now) {
    return 'OVERDUE';
  }

  const hasOverdueMilestone = milestones.some(
    (milestone) =>
      !milestone.isCompleted &&
      milestone.dueDate !== null &&
      milestone.dueDate.getTime() < now,
  );

  return hasOverdueMilestone ? 'AT_RISK' : 'ON_TRACK';
}
