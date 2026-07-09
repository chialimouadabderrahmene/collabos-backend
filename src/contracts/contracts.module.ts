import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractEventsService } from './services/contract-events.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { ContractsService } from './services/contracts.service';
import { SignaturesService } from './services/signatures.service';

@Module({
  controllers: [ContractsController],
  providers: [
    ContractsService,
    SignaturesService,
    ContractEventsService,
    ContractPdfService,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
