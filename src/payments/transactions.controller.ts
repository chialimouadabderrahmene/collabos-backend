import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { TransactionsService } from './services/transactions.service';
import { PaginatedTransactionsResponse } from './types/payment-response.types';

@ApiTags('payments/transactions')
@ApiBearerAuth()
@Controller('payments/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List my transaction ledger' })
  @ApiResponse({ status: 200, type: PaginatedTransactionsResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponse> {
    return this.transactionsService.findMine(user.id, query);
  }
}
