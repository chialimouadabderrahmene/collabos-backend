import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { toInvoiceResponse } from '../mappers/payment.mapper';
import { InvoiceResponse } from '../types/payment-response.types';
import { InvoicePdfService } from './invoice-pdf.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  async generate(
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<InvoiceResponse> {
    const payment = await this.paymentsService.findEntityOrThrow(paymentId);
    this.paymentsService.assertParticipant(payment, user);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new ConflictException(
        'An invoice can only be issued for a succeeded payment',
      );
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { paymentId },
    });

    if (existing) {
      throw new ConflictException('An invoice already exists for this payment');
    }

    const payer = await this.prisma.user.findUniqueOrThrow({
      where: { id: payment.payerId },
    });

    const invoiceNumber = await this.generateInvoiceNumber();
    const issuedAt = new Date();

    const filename = await this.pdfService.generate({
      invoiceNumber,
      amount: payment.amount,
      currency: payment.currency,
      issuedToEmail: payer.email,
      issuedAt,
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        paymentId,
        invoiceNumber,
        issuedToId: payment.payerId,
        amount: payment.amount,
        currency: payment.currency,
        pdfFilename: filename,
        issuedAt,
      },
    });

    return toInvoiceResponse(invoice);
  }

  async findMine(user: AuthenticatedUser): Promise<InvoiceResponse[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { issuedToId: user.id },
      orderBy: { issuedAt: 'desc' },
    });

    return invoices.map((invoice) => toInvoiceResponse(invoice));
  }

  async findOneOrThrow(
    id: string,
    user: AuthenticatedUser,
  ): Promise<InvoiceResponse> {
    const invoice = await this.findEntityOrThrow(id);
    await this.assertParticipant(invoice.paymentId, user);

    return toInvoiceResponse(invoice);
  }

  async getPdfFilePath(id: string, user: AuthenticatedUser): Promise<string> {
    const invoice = await this.findEntityOrThrow(id);
    await this.assertParticipant(invoice.paymentId, user);

    if (!invoice.pdfFilename) {
      throw new NotFoundException('This invoice has no PDF available');
    }

    return this.pdfService.getFilePath(invoice.pdfFilename);
  }

  private async findEntityOrThrow(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async assertParticipant(
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const payment = await this.paymentsService.findEntityOrThrow(paymentId);
    this.paymentsService.assertParticipant(payment, user);
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }
}
