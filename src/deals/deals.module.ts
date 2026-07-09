import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealHealthService } from './services/deal-health.service';
import { DealsService } from './services/deals.service';
import { MilestonesService } from './services/milestones.service';
import { ProposalsService } from './services/proposals.service';
import { ResponsibilitiesService } from './services/responsibilities.service';

@Module({
  controllers: [DealsController],
  providers: [
    DealsService,
    ProposalsService,
    ResponsibilitiesService,
    MilestonesService,
    DealHealthService,
  ],
  exports: [DealsService],
})
export class DealsModule {}
