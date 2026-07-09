import { Brief } from '@prisma/client';
import { BriefResponse } from '../types/brief-response.types';

export function toBriefResponse(brief: Brief): BriefResponse {
  return {
    id: brief.id,
    brandId: brief.brandId,
    title: brief.title,
    description: brief.description,
    budgetMin: brief.budgetMin,
    budgetMax: brief.budgetMax,
    currency: brief.currency,
    deliverables: brief.deliverables,
    applicationDeadline: brief.applicationDeadline,
    location: brief.location,
    isRemote: brief.isRemote,
    status: brief.status,
    closedAt: brief.closedAt,
    archivedAt: brief.archivedAt,
    createdAt: brief.createdAt,
    updatedAt: brief.updatedAt,
  };
}
