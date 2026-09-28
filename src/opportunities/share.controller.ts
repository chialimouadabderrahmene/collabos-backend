import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { OpportunityShareLinksService } from './services/opportunity-share-links.service';
import { SharedOpportunityResponse } from './types/opportunity-response.types';

/**
 * Public, unauthenticated access to a shared opportunity. Only immutable
 * published content is reachable here; drafts are never read. The token is
 * redacted from request logs, error bodies and trace spans (see redactUrl).
 */
@ApiTags('share')
@Public()
@Controller('share')
export class ShareController {
  constructor(
    private readonly shareLinksService: OpportunityShareLinksService,
  ) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ summary: 'Resolve a private share link' })
  @ApiResponse({ status: 200, type: SharedOpportunityResponse })
  @ApiResponse({ status: 404, description: 'Invalid, revoked or expired link' })
  resolve(@Param('token') token: string): Promise<SharedOpportunityResponse> {
    return this.shareLinksService.resolve(token);
  }
}
