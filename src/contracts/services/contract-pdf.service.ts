import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

@Injectable()
export class ContractPdfService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('contract.pdfUploadDir') as string,
    );
  }

  async generate(
    contractId: string,
    versionNumber: number,
    content: string,
  ): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });

    const filename = `${contractId}-v${versionNumber}-${randomUUID()}.pdf`;
    const filePath = join(this.uploadDir, filename);

    await new Promise<void>((resolvePromise, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = createWriteStream(filePath);

      stream.on('finish', resolvePromise);
      stream.on('error', reject);
      doc.on('error', reject);

      doc.pipe(stream);

      doc
        .fontSize(18)
        .text('CollabOS Collaboration Agreement', { align: 'center' })
        .moveDown();

      doc
        .fontSize(10)
        .fillColor('#555555')
        .text(`Contract ID: ${contractId}`)
        .text(`Version: ${versionNumber}`)
        .text(`Generated: ${new Date().toISOString()}`)
        .moveDown()
        .fillColor('#000000');

      doc.fontSize(12).text(content, { align: 'left' });

      doc.end();
    });

    return filename;
  }

  getFilePath(filename: string): string {
    const filePath = join(this.uploadDir, filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('PDF file not found');
    }

    return filePath;
  }
}
