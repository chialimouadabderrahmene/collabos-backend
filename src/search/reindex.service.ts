import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BRANDS_COLLECTION,
  BRANDS_SCHEMA,
  DROPS_COLLECTION,
  DROPS_SCHEMA,
  PRODUCTS_COLLECTION,
  PRODUCTS_SCHEMA,
} from './collections/collection-schemas';
import { TypesenseService } from './typesense.service';

const EPOCH = new Date(0);

@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly typesenseService: TypesenseService,
  ) {}

  /** Full resync from scratch — used for the initial bootstrap or a manual
   * admin-triggered rebuild. */
  async reindexAll(): Promise<void> {
    if (!this.typesenseService.isConfigured()) {
      return;
    }

    await this.ensureCollections();
    await this.syncProducts(EPOCH);
    await this.syncBrands(EPOCH);
    await this.syncDrops(EPOCH);
  }

  /** Watermark-based incremental sync: only re-indexes rows updated since
   * the last successful run for each collection. This is what keeps the
   * search index eventually-consistent without hooking Products/Brands/
   * Drops' own write paths (see the search ADR for why). */
  async reindexIncremental(): Promise<void> {
    if (!this.typesenseService.isConfigured()) {
      return;
    }

    await this.ensureCollections();

    const [productsCursor, brandsCursor, dropsCursor] = await Promise.all([
      this.getCursor(PRODUCTS_COLLECTION),
      this.getCursor(BRANDS_COLLECTION),
      this.getCursor(DROPS_COLLECTION),
    ]);

    const [products, brands, drops] = await Promise.all([
      this.syncProducts(productsCursor),
      this.syncBrands(brandsCursor),
      this.syncDrops(dropsCursor),
    ]);

    if (products + brands + drops > 0) {
      this.logger.log(
        `Reindexed ${products} product(s), ${brands} brand(s), ${drops} drop(s)`,
      );
    }
  }

  private async ensureCollections(): Promise<void> {
    await this.typesenseService.ensureCollection(PRODUCTS_SCHEMA);
    await this.typesenseService.ensureCollection(BRANDS_SCHEMA);
    await this.typesenseService.ensureCollection(DROPS_SCHEMA);
  }

  private async getCursor(collection: string): Promise<Date> {
    const state = await this.prisma.searchSyncState.findUnique({
      where: { collection },
    });
    return state?.lastSyncedAt ?? EPOCH;
  }

  private async setCursor(collection: string, syncedAt: Date): Promise<void> {
    await this.prisma.searchSyncState.upsert({
      where: { collection },
      create: { collection, lastSyncedAt: syncedAt },
      update: { lastSyncedAt: syncedAt },
    });
  }

  private async syncProducts(since: Date): Promise<number> {
    const syncStartedAt = new Date();
    const rows = await this.prisma.product.findMany({
      where: { updatedAt: { gte: since } },
    });

    for (const row of rows) {
      await this.typesenseService.upsertDocument(PRODUCTS_COLLECTION, {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        slug: row.slug,
        brandId: row.brandId,
        price: row.price,
        isActive: row.isActive,
        updatedAt: row.updatedAt.getTime(),
      });
    }

    await this.setCursor(PRODUCTS_COLLECTION, syncStartedAt);
    return rows.length;
  }

  private async syncBrands(since: Date): Promise<number> {
    const syncStartedAt = new Date();
    const rows = await this.prisma.brand.findMany({
      where: { updatedAt: { gte: since } },
    });

    for (const row of rows) {
      await this.typesenseService.upsertDocument(BRANDS_COLLECTION, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isVerified: row.isVerified,
        isActive: row.isActive,
        updatedAt: row.updatedAt.getTime(),
      });
    }

    await this.setCursor(BRANDS_COLLECTION, syncStartedAt);
    return rows.length;
  }

  private async syncDrops(since: Date): Promise<number> {
    const syncStartedAt = new Date();
    const rows = await this.prisma.drop.findMany({
      where: { updatedAt: { gte: since } },
    });

    for (const row of rows) {
      await this.typesenseService.upsertDocument(DROPS_COLLECTION, {
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        slug: row.slug,
        brandId: row.brandId,
        status: row.status,
        updatedAt: row.updatedAt.getTime(),
      });
    }

    await this.setCursor(DROPS_COLLECTION, syncStartedAt);
    return rows.length;
  }
}
