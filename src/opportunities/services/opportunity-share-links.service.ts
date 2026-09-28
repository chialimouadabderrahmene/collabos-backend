import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpportunityActivityType } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SHARE_LINK_MAX_TTL_DAYS } from '../constants/opportunity.constants';
import { CreateShareLinkDto } from '../dto/publishing.dto';
import { toShareLinkResponse } from '../mappers/opportunity.mapper';
import {
  CreatedShareLinkResponse,
  MessageResponse,
  SharedOpportunityResponse,
  ShareLinkResponse,
} from '../types/opportunity-response.types';
import {
  generateShareToken,
  hashShareToken,
  isWellFormedShareToken,
} from '../utils/share-token.util';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityPublishService } from './opportunity-publish.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Private share links, each pinned to one immutable published version.
 * Only a sha256 of the token is stored. The public resolver reads exclusively
 * from `opportunity_versions` (never the draft) and answers every invalid,
 * revoked, expired or archived case with the same 404.
 */
@Injectable()
export class OpportunityShareLinksService {
  private readonly logger = new Logger(OpportunityShareLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly activity: OpportunityActivityService,
    private readonly publishService: OpportunityPublishService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: CreateShareLinkDto,
  ): Promise<CreatedShareLinkResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.SHARE);

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt) {
      const now = Date.now();
      if (expiresAt.getTime() <= now) {
        throw new BadRequestException('expiresAt must be in the future');
      }
      if (expiresAt.getTime() > now + SHARE_LINK_MAX_TTL_DAYS * DAY_MS) {
        throw new BadRequestException(
          `expiresAt can be at most ${SHARE_LINK_MAX_TTL_DAYS} days ahead`,
        );
      }
    }

    const version = await this.prisma.opportunityVersion.findUnique({
      where: {
        opportunityId_versionNumber: {
          opportunityId,
          versionNumber: dto.versionNumber,
        },
      },
      select: { id: true, versionNumber: true },
    });
    if (!version) {
      throw new NotFoundException('Published version not found');
    }

    const { token, tokenHash, tokenPrefix } = generateShareToken();

    const link = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunityShareLink.create({
        data: {
          opportunityId,
          versionId: version.id,
          tokenHash,
          tokenPrefix,
          label: dto.label?.trim() || null,
          expiresAt,
          createdById: user.id,
        },
      });
      // Never log or persist the raw token — only the link ID.
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.SHARE_LINK_CREATED,
        metadata: {
          shareLinkId: created.id,
          versionNumber: version.versionNumber,
          expiresAt: expiresAt?.toISOString() ?? null,
        },
      });
      return created;
    });

    return {
      ...toShareLinkResponse(link, version.versionNumber),
      token,
      url: `${this.shareBaseUrl()}/${token}`,
    };
  }

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<ShareLinkResponse[]> {
    await this.access.authorize(opportunityId, user, OpportunityAction.SHARE);

    const links = await this.prisma.opportunityShareLink.findMany({
      where: { opportunityId },
      include: { version: { select: { versionNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return links.map(({ version, ...link }) =>
      toShareLinkResponse(link, version.versionNumber),
    );
  }

  /** Idempotent: revoking an already-revoked link succeeds. */
  async revoke(
    opportunityId: string,
    linkId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.SHARE);

    const link = await this.prisma.opportunityShareLink.findFirst({
      where: { id: linkId, opportunityId },
      select: { id: true, revokedAt: true },
    });
    if (!link) {
      throw new NotFoundException('Share link not found');
    }
    if (link.revokedAt) {
      return { message: 'Share link revoked' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.opportunityShareLink.updateMany({
        where: { id: linkId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: user.id },
      });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.SHARE_LINK_REVOKED,
        metadata: { shareLinkId: linkId },
      });
    });

    return { message: 'Share link revoked' };
  }

  /** Public resolver behind GET /share/:token. */
  async resolve(token: string): Promise<SharedOpportunityResponse> {
    const notFound = new NotFoundException('Share link not found');

    if (!isWellFormedShareToken(token)) {
      throw notFound;
    }

    const link = await this.prisma.opportunityShareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
      include: {
        opportunity: {
          select: {
            archivedAt: true,
            brand: { select: { name: true, logoUrl: true, isActive: true } },
          },
        },
        version: { include: { assets: { include: { asset: true } } } },
      },
    });

    const now = new Date();
    if (
      !link ||
      link.revokedAt ||
      (link.expiresAt && link.expiresAt <= now) ||
      link.opportunity.archivedAt ||
      !link.opportunity.brand.isActive
    ) {
      throw notFound;
    }

    await this.prisma.opportunityShareLink
      .update({
        where: { id: link.id },
        data: { accessCount: { increment: 1 }, lastAccessedAt: now },
      })
      .catch((error: unknown) =>
        this.logger.warn(
          `Failed to record access for share link ${link.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        ),
      );

    const { version } = link;
    return {
      title: version.title,
      summary: version.summary,
      metadata: version.metadata,
      versionNumber: version.versionNumber,
      publishedAt: version.publishedAt,
      format: version.format,
      schemaVersion: version.schemaVersion,
      content: version.content,
      brand: {
        name: link.opportunity.brand.name,
        logoUrl: link.opportunity.brand.logoUrl,
      },
      assets: await this.publishService.toPublishedAssets(version),
      expiresAt: link.expiresAt,
    };
  }

  private shareBaseUrl(): string {
    const configured = this.configService.get<string>(
      'opportunities.shareBaseUrl',
    );
    return (configured ?? 'http://localhost:5173/share').replace(/\/+$/, '');
  }
}
