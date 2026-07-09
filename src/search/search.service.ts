import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  BRANDS_COLLECTION,
  DROPS_COLLECTION,
  PRODUCTS_COLLECTION,
} from './collections/collection-schemas';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResultsResponse } from './types/search-response.types';
import { TypesenseService } from './typesense.service';

const QUERY_BY_FIELDS: Record<string, string> = {
  [PRODUCTS_COLLECTION]: 'name,description',
  [BRANDS_COLLECTION]: 'name',
  [DROPS_COLLECTION]: 'title,description',
};

@Injectable()
export class SearchService {
  constructor(private readonly typesenseService: TypesenseService) {}

  async search(query: SearchQueryDto): Promise<SearchResultsResponse> {
    if (!this.typesenseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Search is not configured on this environment',
      );
    }

    const queryByFields = QUERY_BY_FIELDS[query.collection];
    const result = await this.typesenseService.search(
      query.collection,
      query.q,
      queryByFields,
      query.page,
      query.limit,
    );

    return {
      found: result.found ?? 0,
      page: query.page,
      hits: (result.hits ?? []).map((hit) => ({
        id: (hit.document as { id: string }).id,
        document: hit.document as Record<string, unknown>,
      })),
    };
  }
}
