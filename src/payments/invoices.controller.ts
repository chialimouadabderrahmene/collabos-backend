import { Controller, Get, Param, Post, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { InvoicesService } from './services/invoices.service';
import { InvoiceResponse } from './types/payment-response.types';

@ApiTags('payments/invoices')
@ApiBearerAuth()
@Controller('payments/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post(':paymentId')
  @ApiOperation({ summary: 'Generate an invoice for a succeeded payment' })
  @ApiResponse({ status: 201, type: InvoiceResponse })
  generate(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceResponse> {
    return this.invoicesService.generate(paymentId, user);
  }

  @Get()
  @ApiOperation({ summary: 'List my invoices' })
  @ApiResponse({ status: 200, type: [InvoiceResponse] })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<InvoiceResponse[]> {
    return this.invoicesService.findMine(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice' })
  @ApiResponse({ status: 200, type: InvoiceResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceResponse> {
    return this.invoicesService.findOneOrThrow(id, user);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download the invoice PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const filePath = await this.invoicesService.getPdfFilePath(id, user);
    return new StreamableFile(createReadStream(filePath));
  }
}
