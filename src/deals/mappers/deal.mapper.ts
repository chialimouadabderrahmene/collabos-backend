import {
  Deal,
  DealMilestone,
  DealProposal,
  DealResponsibility,
} from '@prisma/client';
import {
  DealResponse,
  MilestoneResponse,
  ProposalResponse,
  ResponsibilityResponse,
} from '../types/deal-response.types';
import { computeDealHealth } from '../utils/deal-health.util';

export function toDealResponse(
  deal: Deal,
  milestones: Pick<DealMilestone, 'dueDate' | 'isCompleted'>[] = [],
): DealResponse {
  return {
    id: deal.id,
    applicationId: deal.applicationId,
    briefId: deal.briefId,
    brandId: deal.brandId,
    creatorId: deal.creatorId,
    title: deal.title,
    status: deal.status,
    health: computeDealHealth(deal, milestones),
    totalValue: deal.totalValue,
    currency: deal.currency,
    revenueSplitBrand: deal.revenueSplitBrand,
    revenueSplitCreator: deal.revenueSplitCreator,
    startDate: deal.startDate,
    endDate: deal.endDate,
    activatedAt: deal.activatedAt,
    completedAt: deal.completedAt,
    cancelledAt: deal.cancelledAt,
    cancelReason: deal.cancelReason,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  };
}

export function toProposalResponse(proposal: DealProposal): ProposalResponse {
  return {
    id: proposal.id,
    dealId: proposal.dealId,
    proposedById: proposal.proposedById,
    status: proposal.status,
    totalValue: proposal.totalValue,
    revenueSplitBrand: proposal.revenueSplitBrand,
    revenueSplitCreator: proposal.revenueSplitCreator,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    message: proposal.message,
    createdAt: proposal.createdAt,
    respondedAt: proposal.respondedAt,
  };
}

export function toResponsibilityResponse(
  responsibility: DealResponsibility,
): ResponsibilityResponse {
  return {
    id: responsibility.id,
    party: responsibility.party,
    description: responsibility.description,
    dueDate: responsibility.dueDate,
    isCompleted: responsibility.isCompleted,
    completedAt: responsibility.completedAt,
  };
}

export function toMilestoneResponse(
  milestone: DealMilestone,
): MilestoneResponse {
  return {
    id: milestone.id,
    title: milestone.title,
    dueDate: milestone.dueDate,
    position: milestone.position,
    isCompleted: milestone.isCompleted,
    completedAt: milestone.completedAt,
  };
}
