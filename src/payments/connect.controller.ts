import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ConnectService } from './services/connect.service';
import {
  ConnectAccountResponse,
  ConnectOnboardingResponse,
} from './types/payment-response.types';

@ApiTags('payments/connect')
@ApiBearerAuth()
@Controller('payments/connect')
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Post('onboard')
  @ApiOperation({ summary: 'Start or resume Stripe Connect onboarding' })
  @ApiResponse({ status: 201, type: ConnectOnboardingResponse })
  onboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConnectOnboardingResponse> {
    return this.connectService.onboard(user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get my Stripe Connect account status' })
  @ApiResponse({ status: 200, type: ConnectAccountResponse })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConnectAccountResponse> {
    return this.connectService.getStatus(user);
  }
}
