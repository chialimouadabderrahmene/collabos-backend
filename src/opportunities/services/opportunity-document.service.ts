import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OpportunityAsset, Prisma } from '@prisma/client';
import {
  DOCUMENT_LIMITS,
  METADATA_LIMITS,
} from '../constants/opportunity.constants';
import {
  DocumentValidationError,
  isPlainObject,
  JsonTreeLimits,
  validateJsonTree,
} from '../utils/document.util';

export interface DocumentInput {
  format: string;
  schemaVersion: number;
  content: unknown;
}

export interface ValidatedDocument {
  format: string;
  schemaVersion: number;
  content: Prisma.InputJsonObject;
  assetIds: string[];
}

/** Validation shared by draft save, create and publish, so every entry point
 * applies exactly the same rules. */
@Injectable()
export class OpportunityDocumentService {
  validateDocument(input: DocumentInput): ValidatedDocument {
    const { assetIds } = this.validateTree(input.content, DOCUMENT_LIMITS);
    return {
      format: input.format,
      schemaVersion: input.schemaVersion,
      content: input.content as Prisma.InputJsonObject,
      assetIds,
    };
  }

  validateMetadata(metadata: Record<string, unknown>): Prisma.InputJsonObject {
    const { assetIds } = this.validateTree(metadata, METADATA_LIMITS);
    if (assetIds.length > 0) {
      throw new BadRequestException('Metadata cannot reference assets');
    }
    return metadata as Prisma.InputJsonObject;
  }

  /** Asset IDs referenced by already-stored (hence already-validated)
   * content. */
  referencedAssetIds(content: unknown): string[] {
    if (!isPlainObject(content)) {
      return [];
    }
    try {
      return validateJsonTree(content, DOCUMENT_LIMITS).assetIds;
    } catch {
      return [];
    }
  }

  /** Every referenced asset must belong to this opportunity and not be
   * deleted. Returns the assets, in no particular order. */
  async assertAssetsUsable(
    client: Prisma.TransactionClient,
    opportunityId: string,
    assetIds: string[],
  ): Promise<OpportunityAsset[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await client.opportunityAsset.findMany({
      where: { id: { in: assetIds }, opportunityId, deletedAt: null },
    });

    if (assets.length !== assetIds.length) {
      const found = new Set(assets.map((asset) => asset.id));
      const missing = assetIds.filter((id) => !found.has(id));
      throw new UnprocessableEntityException({
        message: 'Document references assets that are missing or deleted',
        missingAssetIds: missing,
      });
    }

    return assets;
  }

  private validateTree(value: unknown, limits: JsonTreeLimits) {
    if (!isPlainObject(value)) {
      throw new BadRequestException('Expected a JSON object');
    }
    try {
      return validateJsonTree(value, limits);
    } catch (error) {
      if (error instanceof DocumentValidationError) {
        throw new BadRequestException({
          message: 'Invalid structured content',
          issues: error.issues,
        });
      }
      throw error;
    }
  }
}
