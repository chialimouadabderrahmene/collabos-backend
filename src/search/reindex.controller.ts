import { Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReindexService } from './reindex.service';

@ApiTags('search/reindex')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('search/reindex')
export class ReindexController {
  constructor(private readonly reindexService: ReindexService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Trigger a full search index rebuild (admin only)',
  })
  @ApiResponse({ status: 202 })
  async reindexAll(): Promise<{ message: string }> {
    await this.reindexService.reindexAll();
    return { message: 'Reindex complete' };
  }
}
