import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ListTransfersQueryDto } from './dto/list-transfers-query.dto';
import { TransfersService } from './services/transfers.service';
import { PaginatedTransfersResponse } from './types/payout-response.types';

@ApiTags('payouts/transfers')
@ApiBearerAuth()
@Controller('payouts/transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @ApiOperation({
    summary: 'List escrow transfers released into my connected account',
  })
  @ApiResponse({ status: 200, type: PaginatedTransfersResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransfersQueryDto,
  ): Promise<PaginatedTransfersResponse> {
    return this.transfersService.findMine(user.id, query);
  }
}
