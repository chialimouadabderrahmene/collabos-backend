import {
  Opportunity,
  OpportunityActivity,
  OpportunityAiSuggestion,
  OpportunityShareLink,
  OpportunityVersion,
} from '@prisma/client';
import { OpportunityCapabilities } from '../services/opportunity-access.service';
import {
  ActivityResponse,
  AiSuggestionResponse,
  OpportunityResponse,
  ShareLinkResponse,
  ShareLinkStatus,
  VersionSummaryResponse,
} from '../types/opportunity-response.types';

export function assetReference(assetId: string): string {
  return `asset:${assetId}`;
}

export function toOpportunityResponse(
  opportunity: Opportunity,
  capabilities?: OpportunityCapabilities,
): OpportunityResponse {
  return {
    id: opportunity.id,
    brandId: opportunity.brandId,
    createdById: opportunity.createdById,
    title: opportunity.title,
    summary: opportunity.summary,
    status: opportunity.status,
    metadata: opportunity.metadata,
    latestVersionNumber: opportunity.latestVersionNumber,
    lastPublishedAt: opportunity.lastPublishedAt,
    archivedAt: opportunity.archivedAt,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    ...(capabilities ? { capabilities: { ...capabilities } } : {}),
  };
}

export function toVersionSummaryResponse(
  version: OpportunityVersion,
): VersionSummaryResponse {
  return {
    versionNumber: version.versionNumber,
    title: version.title,
    summary: version.summary,
    contentHash: version.contentHash,
    notes: version.notes,
    draftRevision: version.draftRevision,
    publishedById: version.publishedById,
    publishedAt: version.publishedAt,
  };
}

export function shareLinkStatus(
  link: Pick<OpportunityShareLink, 'revokedAt' | 'expiresAt'>,
  now: Date = new Date(),
): ShareLinkStatus {
  if (link.revokedAt) {
    return 'REVOKED';
  }
  if (link.expiresAt && link.expiresAt <= now) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function toShareLinkResponse(
  link: OpportunityShareLink,
  versionNumber: number,
): ShareLinkResponse {
  return {
    id: link.id,
    tokenPrefix: link.tokenPrefix,
    versionNumber,
    label: link.label,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    status: shareLinkStatus(link),
    accessCount: link.accessCount,
    lastAccessedAt: link.lastAccessedAt,
    createdById: link.createdById,
    createdAt: link.createdAt,
  };
}

export function toActivityResponse(
  activity: OpportunityActivity,
): ActivityResponse {
  return {
    id: activity.id,
    type: activity.type,
    actorId: activity.actorId,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  };
}

export function toAiSuggestionResponse(
  suggestion: OpportunityAiSuggestion,
): AiSuggestionResponse {
  return {
    id: suggestion.id,
    kind: suggestion.kind,
    status: suggestion.status,
    output: suggestion.output,
    model: suggestion.model,
    requestedById: suggestion.requestedById,
    createdAt: suggestion.createdAt,
    resolvedAt: suggestion.resolvedAt,
  };
}
