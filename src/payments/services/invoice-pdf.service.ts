import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

@Injectable()
export class InvoicePdfService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('invoice.pdfUploadDir') as string,
    );
  }

  async generate(params: {
    invoiceNumber: string;
    amount: number;
    currency: string;
    issuedToEmail: string;
    issuedAt: Date;
  }): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });

    const filename = `${params.invoiceNumber}-${randomUUID()}.pdf`;
    const filePath = join(this.uploadDir, filename);

    await new Promise<void>((resolvePromise, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = createWriteStream(filePath);

      stream.on('finish', resolvePromise);
      stream.on('error', reject);
      doc.on('error', reject);

      doc.pipe(stream);

      doc.fontSize(18).text('CollabOS Invoice', { align: 'center' }).moveDown();

      doc
        .fontSize(10)
        .fillColor('#555555')
        .text(`Invoice Number: ${params.invoiceNumber}`)
        .text(`Issued: ${params.issuedAt.toISOString()}`)
        .text(`Billed to: ${params.issuedToEmail}`)
        .moveDown()
        .fillColor('#000000');

      doc
        .fontSize(14)
        .text(
          `Amount: ${params.amount.toFixed(2)} ${params.currency.toUpperCase()}`,
        );

      doc.end();
    });

    return filename;
  }

  getFilePath(filename: string): string {
    const filePath = join(this.uploadDir, filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Invoice PDF not found');
    }

    return filePath;
  }
}
