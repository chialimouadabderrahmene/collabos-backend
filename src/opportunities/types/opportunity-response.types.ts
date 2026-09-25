import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OpportunityActivityType,
  OpportunityAiSuggestionKind,
  OpportunityAiSuggestionStatus,
  OpportunityAssetKind,
  OpportunityMemberRole,
  OpportunityStatus,
} from '@prisma/client';

export class MessageResponse {
  @ApiProperty()
  message!: string;
}

export class OpportunityCapabilitiesResponse {
  @ApiProperty() view!: boolean;
  @ApiProperty() edit!: boolean;
  @ApiProperty() publish!: boolean;
  @ApiProperty() share!: boolean;
  @ApiProperty() manage!: boolean;
}

export class OpportunityResponse {
  @ApiProperty() id!: string;
  @ApiProperty() brandId!: string;
  @ApiProperty() createdById!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ enum: OpportunityStatus }) status!: OpportunityStatus;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: unknown;
  @ApiProperty({ description: '0 until first publish' })
  latestVersionNumber!: number;
  @ApiProperty({ nullable: true }) lastPublishedAt!: Date | null;
  @ApiProperty({ nullable: true }) archivedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({
    type: OpportunityCapabilitiesResponse,
    description: 'What the current user may do (single-item endpoints)',
  })
  capabilities?: OpportunityCapabilitiesResponse;
}

export class PaginatedOpportunitiesResponse {
  @ApiProperty({ type: [OpportunityResponse] }) data!: OpportunityResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class OpportunityMemberResponse {
  @ApiProperty() userId!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true }) displayName!: string | null;
  @ApiProperty({ enum: OpportunityMemberRole }) role!: OpportunityMemberRole;
  @ApiProperty() createdAt!: Date;
}

export class DraftResponse {
  @ApiProperty() opportunityId!: string;
  @ApiProperty({ description: 'Editor format, or "blank" for a new draft' })
  format!: string;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;
  @ApiProperty({ description: 'Send back as baseRevision when saving' })
  revision!: number;
  @ApiProperty({ nullable: true }) updatedById!: string | null;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty() latestVersionNumber!: number;
  @ApiProperty({
    description:
      'True when the draft differs from the latest published version',
  })
  hasUnpublishedChanges!: boolean;
}

export class AssetResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: OpportunityAssetKind }) kind!: OpportunityAssetKind;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ nullable: true }) width!: number | null;
  @ApiProperty({ nullable: true }) height!: number | null;
  @ApiProperty({ nullable: true }) altText!: string | null;
  @ApiProperty({ nullable: true }) originalFilename!: string | null;
  @ApiProperty({ description: 'Reference to embed in the document' })
  reference!: string;
  @ApiProperty({ description: 'Short-lived signed URL' }) url!: string;
  @ApiProperty() urlExpiresAt!: Date;
  @ApiProperty() createdAt!: Date;
}

export class PublishedAssetResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: OpportunityAssetKind }) kind!: OpportunityAssetKind;
  @ApiProperty() mimeType!: string;
  @ApiProperty({ nullable: true }) width!: number | null;
  @ApiProperty({ nullable: true }) height!: number | null;
  @ApiProperty({ nullable: true, description: 'As published (snapshot)' })
  altText!: string | null;
  @ApiProperty() reference!: string;
  @ApiProperty({ description: 'Short-lived signed URL' }) url!: string;
  @ApiProperty() urlExpiresAt!: Date;
}

export class VersionSummaryResponse {
  @ApiProperty() versionNumber!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ description: 'sha256 of the canonical snapshot' })
  contentHash!: string;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty() draftRevision!: number;
  @ApiProperty() publishedById!: string;
  @ApiProperty() publishedAt!: Date;
}

export class VersionResponse extends VersionSummaryResponse {
  @ApiProperty() format!: string;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: unknown;
  @ApiProperty({ type: [PublishedAssetResponse] })
  assets!: PublishedAssetResponse[];
}

export type ShareLinkStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export class ShareLinkResponse {
  @ApiProperty() id!: string;
  @ApiProperty({
    description: 'First characters of the token, to recognise it',
  })
  tokenPrefix!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty({ nullable: true }) label!: string | null;
  @ApiProperty({ nullable: true }) expiresAt!: Date | null;
  @ApiProperty({ nullable: true }) revokedAt!: Date | null;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED', 'EXPIRED'] })
  status!: ShareLinkStatus;
  @ApiProperty() accessCount!: number;
  @ApiProperty({ nullable: true }) lastAccessedAt!: Date | null;
  @ApiProperty() createdById!: string;
  @ApiProperty() createdAt!: Date;
}

export class CreatedShareLinkResponse extends ShareLinkResponse {
  @ApiProperty({
    description: 'Secret token. Returned only once; only its hash is stored.',
  })
  token!: string;
  @ApiProperty() url!: string;
}

export class SharedBrandResponse {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
}

/** Public projection of an immutable published version. Carries no internal
 * IDs (opportunity, version, users) and never any draft data. */
export class SharedOpportunityResponse {
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: unknown;
  @ApiProperty() versionNumber!: number;
  @ApiProperty() publishedAt!: Date;
  @ApiProperty() format!: string;
  @ApiProperty() schemaVersion!: number;
  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;
  @ApiProperty({ type: SharedBrandResponse }) brand!: SharedBrandResponse;
  @ApiProperty({ type: [PublishedAssetResponse] })
  assets!: PublishedAssetResponse[];
  @ApiProperty({ nullable: true }) expiresAt!: Date | null;
}

export class ActivityResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: OpportunityActivityType })
  type!: OpportunityActivityType;
  @ApiProperty({ nullable: true }) actorId!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  metadata!: unknown;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedActivityResponse {
  @ApiProperty({ type: [ActivityResponse] }) data!: ActivityResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class AiSuggestionResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: OpportunityAiSuggestionKind })
  kind!: OpportunityAiSuggestionKind;
  @ApiProperty({ enum: OpportunityAiSuggestionStatus })
  status!: OpportunityAiSuggestionStatus;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Proposed content. Never applied automatically — the client applies/edits it and saves the draft.',
  })
  output!: unknown;
  @ApiProperty() model!: string;
  @ApiProperty() requestedById!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true }) resolvedAt!: Date | null;
}

export class PaginatedAiSuggestionsResponse {
  @ApiProperty({ type: [AiSuggestionResponse] }) data!: AiSuggestionResponse[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
