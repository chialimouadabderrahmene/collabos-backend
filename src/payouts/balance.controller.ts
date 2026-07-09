import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { BalanceService } from './services/balance.service';
import { BalanceResponse } from './types/payout-response.types';

@ApiTags('payouts/balance')
@ApiBearerAuth()
@Controller('payouts/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get my available payout balance' })
  @ApiResponse({ status: 200, type: BalanceResponse })
  getBalance(@CurrentUser() user: AuthenticatedUser): Promise<BalanceResponse> {
    return this.balanceService.getBalance(user.id);
  }
}
