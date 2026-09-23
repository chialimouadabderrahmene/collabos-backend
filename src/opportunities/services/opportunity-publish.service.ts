import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OpportunityActivityType,
  OpportunityStatus,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { OutboxPublisherService } from '../../events/outbox-publisher.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BLANK_DOCUMENT_FORMAT,
  OPPORTUNITY_AGGREGATE_TYPE,
} from '../constants/opportunity.constants';
import { PublishOpportunityDto } from '../dto/publishing.dto';
import {
  OPPORTUNITY_PUBLISHED_EVENT_TYPE,
  OpportunityPublishedPayload,
} from '../events/opportunity-published.event';
import {
  assetReference,
  toVersionSummaryResponse,
} from '../mappers/opportunity.mapper';
import {
  PublishedAssetResponse,
  VersionResponse,
  VersionSummaryResponse,
} from '../types/opportunity-response.types';
import { canonicalJson, sha256Hex } from '../utils/document.util';
import { AssetUrlService } from './asset-url.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDocumentService } from './opportunity-document.service';

const VERSION_WITH_ASSETS = {
  assets: { include: { asset: true } },
} as const satisfies Prisma.OpportunityVersionInclude;

export type VersionWithAssets = Prisma.OpportunityVersionGetPayload<{
  include: typeof VERSION_WITH_ASSETS;
}>;

/**
 * Publishing turns the current draft into a new immutable version.
 *
 * Concurrency: the first statement of the transaction is an atomic
 * `latestVersionNumber = latestVersionNumber + 1` on the opportunity row. That
 * row lock serialises concurrent publishes (and draft saves / asset deletes,
 * which take the same lock), so each publish reads a stable draft and gets a
 * unique number. `@@unique([opportunityId, versionNumber])` is the backstop.
 *
 * Immutability: versions are only ever inserted. There is no update/delete
 * code path, and a database trigger rejects UPDATE/DELETE on version rows.
 */
@Injectable()
export class OpportunityPublishService {
  private readonly logger = new Logger(OpportunityPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly documents: OpportunityDocumentService,
    private readonly activity: OpportunityActivityService,
    private readonly assetUrls: AssetUrlService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async publish(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: PublishOpportunityDto,
  ): Promise<VersionResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.PUBLISH);

    let result: { version: VersionWithAssets; outboxEventId: string };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // 1. Allocate the version number atomically (row lock until commit).
        const opportunity = await tx.opportunity.update({
          where: { id: opportunityId, archivedAt: null },
          data: {
            latestVersionNumber: { increment: 1 },
            status: OpportunityStatus.PUBLISHED,
            lastPublishedAt: new Date(),
          },
        });

        // 2. Load and re-validate the draft under the lock.
        const draft = await tx.opportunityDraft.findUnique({
          where: { opportunityId },
        });
        if (!draft) {
          throw new NotFoundException('Draft not found');
        }
        if (
          dto.expectedDraftRevision !== undefined &&
          draft.revision !== dto.expectedDraftRevision
        ) {
          throw new ConflictException({
            message: 'The draft changed since it was reviewed',
            currentRevision: draft.revision,
          });
        }
        if (draft.format === BLANK_DOCUMENT_FORMAT) {
          throw new UnprocessableEntityException(
            'The draft is empty; add content before publishing',
          );
        }

        const document = this.documents.validateDocument({
          format: draft.format,
          schemaVersion: draft.schemaVersion,
          content: draft.content,
        });

        // 3. Resolve the assets the publication needs (must be live).
        const assets = await this.documents.assertAssetsUsable(
          tx,
          opportunityId,
          document.assetIds,
        );

        // 4. Snapshot + integrity hash.
        const metadata = opportunity.metadata as Prisma.InputJsonValue;
        const contentHash = sha256Hex(
          canonicalJson({
            title: opportunity.title,
            summary: opportunity.summary,
            metadata: opportunity.metadata,
            format: document.format,
            schemaVersion: document.schemaVersion,
            content: document.content,
          }),
        );

        // 5. Insert the immutable version with its pinned assets.
        const version = await tx.opportunityVersion.create({
          data: {
            opportunityId,
            versionNumber: opportunity.latestVersionNumber,
            title: opportunity.title,
            summary: opportunity.summary,
            metadata,
            format: document.format,
            schemaVersion: document.schemaVersion,
            content: document.content,
            contentHash,
            draftRevision: draft.revision,
            notes: dto.notes?.trim() || null,
            publishedById: user.id,
            assets: {
              create: assets.map((asset) => ({
                assetId: asset.id,
                altText: asset.altText,
              })),
            },
          },
          include: VERSION_WITH_ASSETS,
        });

        await this.activity.record(tx, {
          opportunityId,
          actorId: user.id,
          type: OpportunityActivityType.PUBLISHED,
          metadata: {
            versionNumber: version.versionNumber,
            draftRevision: draft.revision,
            assetCount: assets.length,
          },
        });

        // 6. Outbox row commits atomically with the publication.
        const payload: OpportunityPublishedPayload = {
          opportunityId,
          brandId: opportunity.brandId,
          versionId: version.id,
          versionNumber: version.versionNumber,
          publishedById: user.id,
          title: version.title,
        };
        const outboxEvent = await tx.outboxEvent.create({
          data: {
            aggregateType: OPPORTUNITY_AGGREGATE_TYPE,
            aggregateId: opportunityId,
            eventType: OPPORTUNITY_PUBLISHED_EVENT_TYPE,
            payload: { ...payload },
          },
        });

        return { version, outboxEventId: outboxEvent.id };
      });
    } catch (error) {
      throw this.mapPublishError(error);
    }

    // Fast-path dispatch; the outbox poller is the safety net if this fails.
    await this.outboxPublisher
      .scheduleDispatch(result.outboxEventId)
      .catch((error: unknown) =>
        this.logger.warn(
          `Outbox fast-path dispatch failed for ${result.outboxEventId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        ),
      );

    return this.toVersionResponse(result.version);
  }

  async listVersions(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<VersionSummaryResponse[]> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const versions = await this.prisma.opportunityVersion.findMany({
      where: { opportunityId },
      orderBy: { versionNumber: 'desc' },
    });

    return versions.map(toVersionSummaryResponse);
  }

  async getVersion(
    opportunityId: string,
    versionNumber: number,
    user: AuthenticatedUser,
  ): Promise<VersionResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const version = await this.prisma.opportunityVersion.findUnique({
      where: {
        opportunityId_versionNumber: { opportunityId, versionNumber },
      },
      include: VERSION_WITH_ASSETS,
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return this.toVersionResponse(version);
  }

  async toVersionResponse(
    version: VersionWithAssets,
  ): Promise<VersionResponse> {
    return {
      ...toVersionSummaryResponse(version),
      format: version.format,
      schemaVersion: version.schemaVersion,
      content: version.content,
      metadata: version.metadata,
      assets: await this.toPublishedAssets(version),
    };
  }

  /** Signed URLs for the assets pinned to a version, with the alt text as it
   * was at publication time. */
  async toPublishedAssets(
    version: VersionWithAssets,
  ): Promise<PublishedAssetResponse[]> {
    return Promise.all(
      version.assets.map(async ({ asset, altText }) => {
        const signed = await this.assetUrls.sign(asset.storageKey);
        return {
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          altText,
          reference: assetReference(asset.id),
          url: signed.url,
          urlExpiresAt: signed.urlExpiresAt,
        };
      }),
    );
  }

  private mapPublishError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // The row vanished from `archivedAt: null` between authorize and
        // the lock: archived concurrently.
        return new ConflictException('Opportunity is archived');
      }
      if (error.code === 'P2002') {
        return new ConflictException(
          'A concurrent publish claimed this version number; retry',
        );
      }
    }
    return error;
  }
}
