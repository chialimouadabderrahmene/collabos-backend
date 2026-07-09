import { Application } from '@prisma/client';
import { ApplicationResponse } from '../types/application-response.types';

export function toApplicationResponse(
  application: Application,
): ApplicationResponse {
  return {
    id: application.id,
    briefId: application.briefId,
    applicantId: application.applicantId,
    status: application.status,
    coverMessage: application.coverMessage,
    proposedBudget: application.proposedBudget,
    decidedAt: application.decidedAt,
    withdrawnAt: application.withdrawnAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}
