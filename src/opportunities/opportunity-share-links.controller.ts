import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateShareLinkDto } from './dto/publishing.dto';
import { OpportunityShareLinksService } from './services/opportunity-share-links.service';
import {
  CreatedShareLinkResponse,
  MessageResponse,
  ShareLinkResponse,
} from './types/opportunity-response.types';

@ApiTags('opportunities/share-links')
@ApiBearerAuth()
@Controller('opportunities/:id/share-links')
export class OpportunityShareLinksController {
  constructor(
    private readonly shareLinksService: OpportunityShareLinksService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Create a private link pinned to a published version. The token is returned only once.',
  })
  @ApiResponse({ status: 201, type: CreatedShareLinkResponse })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShareLinkDto,
  ): Promise<CreatedShareLinkResponse> {
    return this.shareLinksService.create(id, user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List share links (without tokens)' })
  @ApiResponse({ status: 200, type: [ShareLinkResponse] })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShareLinkResponse[]> {
    return this.shareLinksService.list(id, user);
  }

  @Delete(':linkId')
  @ApiOperation({ summary: 'Revoke a share link (idempotent)' })
  @ApiResponse({ status: 200, type: MessageResponse })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.shareLinksService.revoke(id, linkId, user);
  }
}
