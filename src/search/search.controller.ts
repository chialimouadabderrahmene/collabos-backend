import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';
import { SearchResultsResponse } from './types/search-response.types';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Full-text search products, brands, or drops' })
  @ApiResponse({ status: 200, type: SearchResultsResponse })
  search(@Query() query: SearchQueryDto): Promise<SearchResultsResponse> {
    return this.searchService.search(query);
  }
}
