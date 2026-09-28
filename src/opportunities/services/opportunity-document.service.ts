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
import {
  OPPORTUNITY_SPEC_VERSION,
  validateOpportunitySpec,
} from '../schemas/opportunity-spec.schema';

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

  /**
   * Generic JSON-tree safety (size/depth/prototype-pollution — same as any
   * other metadata) plus, when the caller included a `spec` key, R1's
   * structural validation of it (see opportunity-spec.schema.ts). Every
   * other key in `metadata` (e.g. `collaborationType`, `season`,
   * `presentation`) passes through untouched, exactly as before R1.
   */
  validateMetadata(metadata: Record<string, unknown>): Prisma.InputJsonObject {
    const { assetIds } = this.validateTree(metadata, METADATA_LIMITS);
    if (assetIds.length > 0) {
      throw new BadRequestException('Metadata cannot reference assets');
    }
    return this.normalizeSpec(metadata);
  }

  /**
   * Defensive re-check used at publish time (see
   * OpportunityPublishService): the spec was already validated when it was
   * written, so this should never fail in practice, but publish is the
   * boundary where a structurally invalid spec would otherwise be
   * snapshotted permanently into an immutable version.
   */
  assertPublishableMetadata(metadata: unknown): void {
    if (!isPlainObject(metadata) || metadata.spec === undefined) {
      return;
    }
    const result = validateOpportunitySpec(metadata.spec);
    if (!result.ok) {
      throw new UnprocessableEntityException({
        message:
          'Opportunity specification is invalid; fix it before publishing',
        issues: result.issues,
      });
    }
  }

  /** `metadata.spec`, if present, is validated and its (trimmed, normalized)
   * value written back under a server-set `specVersion` — the client is not
   * required to send `specVersion` itself (it defaults to the current
   * version), but if it does send one, it must match: an unrecognised
   * version is rejected rather than silently coerced, so a future
   * `specVersion: 2` migration can tell old and new shapes apart. No `spec`
   * key means "no opinion": the metadata object is returned exactly as
   * given, so opportunities created before R1 (or updates that never touch
   * `spec`) are completely unaffected. */
  private normalizeSpec(
    metadata: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    if (metadata.spec === undefined) {
      return metadata as Prisma.InputJsonObject;
    }
    if (
      metadata.specVersion !== undefined &&
      metadata.specVersion !== OPPORTUNITY_SPEC_VERSION
    ) {
      throw new BadRequestException({
        message: `Unsupported opportunity specification version: ${JSON.stringify(metadata.specVersion)}`,
        issues: [`specVersion must be ${OPPORTUNITY_SPEC_VERSION}`],
      });
    }
    const result = validateOpportunitySpec(metadata.spec);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Invalid opportunity specification',
        issues: result.issues,
      });
    }
    return {
      ...metadata,
      spec: result.spec,
      specVersion: OPPORTUNITY_SPEC_VERSION,
    };
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
