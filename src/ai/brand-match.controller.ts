import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { BrandMatchService } from './services/brand-match.service';
import { BrandMatchResponse } from './types/ai-response.types';

@ApiTags('ai/brand-match')
@ApiBearerAuth()
@Controller('ai/brand-match')
export class BrandMatchController {
  constructor(private readonly brandMatchService: BrandMatchService) {}

  @Get(':brandId')
  @ApiOperation({
    summary: 'Get my AI match score against a brand',
  })
  @ApiResponse({ status: 200, type: BrandMatchResponse })
  getMatch(
    @Param('brandId') brandId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandMatchResponse> {
    return this.brandMatchService.getMatch(brandId, user);
  }
}
