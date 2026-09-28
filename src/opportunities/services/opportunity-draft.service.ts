import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OpportunityDraft } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { BLANK_DOCUMENT_FORMAT } from '../constants/opportunity.constants';
import { SaveDraftDto } from '../dto/opportunity.dto';
import { DraftResponse } from '../types/opportunity-response.types';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityDocumentService } from './opportunity-document.service';

/**
 * The draft is the only mutable copy of the document. Saves use optimistic
 * concurrency (`baseRevision`): a stale client gets 409 instead of silently
 * overwriting a collaborator's work. Published versions are separate rows and
 * are never touched here.
 */
@Injectable()
export class OpportunityDraftService {
  private readonly logger = new Logger(OpportunityDraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly documents: OpportunityDocumentService,
  ) {}

  async get(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<DraftResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);
    return this.load(opportunityId);
  }

  async save(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: SaveDraftDto,
  ): Promise<DraftResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.EDIT);

    const document = this.documents.validateDocument(dto);

    const saved = await this.prisma.$transaction(async (tx) => {
      // Opportunity row lock first (same lock as publish and asset delete),
      // then verify assets against committed state.
      await tx.opportunity.update({
        where: { id: opportunityId },
        data: { updatedAt: new Date() },
      });
      await this.documents.assertAssetsUsable(
        tx,
        opportunityId,
        document.assetIds,
      );

      const { count } = await tx.opportunityDraft.updateMany({
        where: { opportunityId, revision: dto.baseRevision },
        data: {
          format: document.format,
          schemaVersion: document.schemaVersion,
          content: document.content,
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });

      return count > 0;
    });

    if (!saved) {
      const current = await this.prisma.opportunityDraft.findUnique({
        where: { opportunityId },
        select: { revision: true },
      });
      if (!current) {
        throw new NotFoundException('Draft not found');
      }
      throw new ConflictException({
        message:
          'The draft was modified since your base revision; reload and merge before saving',
        currentRevision: current.revision,
      });
    }

    this.logger.debug(
      `Draft saved opportunity=${opportunityId} user=${user.id} fromRevision=${dto.baseRevision}`,
    );

    return this.load(opportunityId);
  }

  private async load(opportunityId: string): Promise<DraftResponse> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { latestVersionNumber: true },
    });
    const latestVersionNumber = opportunity?.latestVersionNumber ?? 0;

    const [draft, latestVersion] = await Promise.all([
      this.prisma.opportunityDraft.findUnique({ where: { opportunityId } }),
      latestVersionNumber > 0
        ? this.prisma.opportunityVersion.findUnique({
            where: {
              opportunityId_versionNumber: {
                opportunityId,
                versionNumber: latestVersionNumber,
              },
            },
            select: { draftRevision: true },
          })
        : Promise.resolve(null),
    ]);

    if (!draft) {
      throw new NotFoundException('Draft not found');
    }

    return toDraftResponse(draft, latestVersionNumber, latestVersion);
  }
}

function toDraftResponse(
  draft: OpportunityDraft,
  latestVersionNumber: number,
  latestVersion: { draftRevision: number } | null,
): DraftResponse {
  const hasUnpublishedChanges = latestVersion
    ? latestVersion.draftRevision !== draft.revision
    : draft.format !== BLANK_DOCUMENT_FORMAT;

  return {
    opportunityId: draft.opportunityId,
    format: draft.format,
    schemaVersion: draft.schemaVersion,
    content: draft.content,
    revision: draft.revision,
    updatedById: draft.updatedById,
    updatedAt: draft.updatedAt,
    latestVersionNumber,
    hasUnpublishedChanges,
  };
}
