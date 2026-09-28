import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OpportunityActivityType,
  OpportunityAsset,
  OpportunityAssetKind,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../storage/storage-provider.interface';
import { UpdateAssetDto, UploadAssetDto } from '../dto/publishing.dto';
import { assetReference } from '../mappers/opportunity.mapper';
import {
  AssetResponse,
  MessageResponse,
} from '../types/opportunity-response.types';
import { sha256Hex } from '../utils/document.util';
import { sniffFile } from '../utils/file-signature.util';
import { AssetUrlService } from './asset-url.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityDocumentService } from './opportunity-document.service';

/** Client MIME spellings that mean the same type as the sniffed one. */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

@Injectable()
export class OpportunityAssetsService {
  private readonly logger = new Logger(OpportunityAssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly activity: OpportunityActivityService,
    private readonly documents: OpportunityDocumentService,
    private readonly assetUrls: AssetUrlService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Validates by content (magic bytes), not by client claims: the declared
   * MIME type must match the sniffed type, images must have sane dimensions,
   * and PDFs are only accepted as references. SVG is never accepted.
   */
  async upload(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: UploadAssetDto,
    file: Express.Multer.File | undefined,
  ): Promise<AssetResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.EDIT);

    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('A non-empty file is required');
    }

    const maxBytes = this.maxSizeBytes();
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `Assets must be smaller than ${maxBytes / (1024 * 1024)}MB`,
      );
    }

    const sniffed = sniffFile(file.buffer);
    if (!sniffed) {
      throw new UnsupportedMediaTypeException(
        'Unsupported or malformed file. Allowed: JPEG, PNG, WEBP or GIF images, and PDF for references',
      );
    }
    if (
      sniffed.mimeType === 'application/pdf' &&
      dto.kind !== OpportunityAssetKind.REFERENCE
    ) {
      throw new UnsupportedMediaTypeException(
        'PDF files can only be uploaded as references',
      );
    }

    const declared = MIME_ALIASES[file.mimetype] ?? file.mimetype;
    if (declared !== sniffed.mimeType) {
      throw new UnsupportedMediaTypeException(
        'File content does not match its declared type',
      );
    }

    // Opaque key: it appears in signed URLs, so it must not reveal the
    // opportunity, brand or uploader.
    const storageKey = `opportunity-assets/${randomUUID()}.${sniffed.extension}`;
    await this.storage.upload({
      key: storageKey,
      buffer: file.buffer,
      contentType: sniffed.mimeType,
    });

    let asset: OpportunityAsset;
    try {
      asset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.opportunityAsset.create({
          data: {
            opportunityId,
            uploadedById: user.id,
            kind: dto.kind,
            storageKey,
            mimeType: sniffed.mimeType,
            sizeBytes: file.size,
            width: sniffed.width,
            height: sniffed.height,
            checksum: sha256Hex(file.buffer),
            originalFilename: sanitizeFilename(file.originalname),
            altText: dto.altText?.trim() || null,
          },
        });
        await this.activity.record(tx, {
          opportunityId,
          actorId: user.id,
          type: OpportunityActivityType.ASSET_UPLOADED,
          metadata: {
            assetId: created.id,
            kind: created.kind,
            mimeType: created.mimeType,
            sizeBytes: created.sizeBytes,
          },
        });
        return created;
      });
    } catch (error) {
      // Compensate: never leave an orphaned object without a database row.
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }

    return this.toResponse(asset);
  }

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<AssetResponse[]> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const assets = await this.prisma.opportunityAsset.findMany({
      where: { opportunityId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(assets.map((asset) => this.toResponse(asset)));
  }

  async updateAltText(
    opportunityId: string,
    assetId: string,
    user: AuthenticatedUser,
    dto: UpdateAssetDto,
  ): Promise<AssetResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.EDIT);
    await this.findActive(opportunityId, assetId);

    // Published versions keep their own alt-text snapshot; this only affects
    // the draft and future publications.
    const updated = await this.prisma.opportunityAsset.update({
      where: { id: assetId },
      data: { altText: dto.altText.trim() || null },
    });

    return this.toResponse(updated);
  }

  /**
   * Soft-deletes the asset. Refused while the draft still references it.
   * The stored object is removed only if no published version uses it —
   * published versions must keep rendering exactly as published.
   */
  async remove(
    opportunityId: string,
    assetId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.EDIT);
    const asset = await this.findActive(opportunityId, assetId);

    const publishedUses = await this.prisma.$transaction(async (tx) => {
      // Take the opportunity row lock first: publish and draft-save take the
      // same lock, so neither can start using this asset between the checks
      // below and the delete.
      await tx.opportunity.update({
        where: { id: opportunityId },
        data: { updatedAt: new Date() },
      });

      const draft = await tx.opportunityDraft.findUnique({
        where: { opportunityId },
        select: { content: true },
      });
      if (
        draft &&
        this.documents.referencedAssetIds(draft.content).includes(assetId)
      ) {
        throw new ConflictException(
          'Asset is used in the draft; remove it from the document first',
        );
      }

      const uses = await tx.opportunityVersionAsset.count({
        where: { assetId },
      });

      await tx.opportunityAsset.update({
        where: { id: assetId },
        data: { deletedAt: new Date() },
      });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.ASSET_DELETED,
        metadata: { assetId, retainedForPublishedVersions: uses > 0 },
      });

      return uses;
    });

    if (publishedUses === 0) {
      await this.storage.delete(asset.storageKey).catch((error: unknown) => {
        this.logger.warn(
          `Failed to delete stored object for asset ${assetId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
    }

    return { message: 'Asset deleted' };
  }

  private async findActive(
    opportunityId: string,
    assetId: string,
  ): Promise<OpportunityAsset> {
    const asset = await this.prisma.opportunityAsset.findFirst({
      where: { id: assetId, opportunityId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  private maxSizeBytes(): number {
    return (
      (this.configService.get<number>('opportunities.assetMaxSizeMb') ?? 15) *
      1024 *
      1024
    );
  }

  private async toResponse(asset: OpportunityAsset): Promise<AssetResponse> {
    const signed = await this.assetUrls.sign(asset.storageKey);
    return {
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
      originalFilename: asset.originalFilename,
      reference: assetReference(asset.id),
      url: signed.url,
      urlExpiresAt: signed.urlExpiresAt,
      createdAt: asset.createdAt,
    };
  }
}

/** Keeps only a display name: no directories, no control characters. */
export function sanitizeFilename(name: string | undefined): string | null {
  if (!name) {
    return null;
  }
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned ? cleaned.slice(0, 255) : null;
}
