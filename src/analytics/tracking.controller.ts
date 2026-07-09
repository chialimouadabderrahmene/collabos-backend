import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { TrackPageViewDto } from './dto/track-page-view.dto';
import { TrackingService } from './services/tracking.service';
import { MessageResponse } from './types/analytics-response.types';

@ApiTags('analytics/tracking')
@Controller('analytics/track')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Record a page view (anonymous, public)' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async track(@Body() dto: TrackPageViewDto): Promise<MessageResponse> {
    await this.trackingService.track(dto);
    return { message: 'ok' };
  }
}
