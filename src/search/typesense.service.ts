import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as TypesenseClient } from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { ObjectAlreadyExists } from 'typesense/lib/Typesense/Errors';

@Injectable()
export class TypesenseService {
  private readonly logger = new Logger(TypesenseService.name);
  private readonly client: TypesenseClient | undefined;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('typesense.host');

    this.client = host
      ? new TypesenseClient({
          nodes: [
            {
              host,
              port: this.configService.get<number>('typesense.port') as number,
              protocol: this.configService.get<string>(
                'typesense.protocol',
              ) as string,
            },
          ],
          apiKey: this.configService.get<string>('typesense.apiKey') ?? '',
          connectionTimeoutSeconds: 5,
        })
      : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  async ensureCollection(schema: CollectionCreateSchema): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.collections().create(schema);
      this.logger.log(`Created Typesense collection "${schema.name}"`);
    } catch (error) {
      if (error instanceof ObjectAlreadyExists) {
        return;
      }
      throw error;
    }
  }

  async upsertDocument(
    collection: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    await this.requireClient()
      .collections(collection)
      .documents()
      .upsert(document);
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    await this.requireClient()
      .collections(collection)
      .documents(id)
      .delete()
      .catch(() => undefined);
  }

  async search(
    collection: string,
    query: string,
    queryByFields: string,
    page: number,
    limit: number,
  ) {
    return this.requireClient().collections(collection).documents().search({
      q: query,
      query_by: queryByFields,
      page,
      per_page: limit,
    });
  }

  private requireClient(): TypesenseClient {
    if (!this.client) {
      throw new Error('Typesense is not configured');
    }
    return this.client;
  }
}
