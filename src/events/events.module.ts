import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DomainEventRegistry } from './domain-event-registry.service';
import { OutboxDeadLetterListener } from './outbox-dead-letter.listener';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OUTBOX_QUEUE } from './outbox-queue.constant';
import { OutboxQueryService } from './outbox-query.service';
import { OutboxController } from './outbox.controller';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { ReplayService } from './replay.service';

@Module({
  imports: [CqrsModule, BullModule.registerQueue({ name: OUTBOX_QUEUE })],
  controllers: [OutboxController],
  providers: [
    OutboxService,
    DomainEventRegistry,
    OutboxPublisherService,
    OutboxProcessor,
    OutboxDeadLetterListener,
    OutboxQueryService,
    ReplayService,
  ],
  exports: [
    CqrsModule,
    OutboxService,
    DomainEventRegistry,
    OutboxPublisherService,
  ],
})
export class EventsModule {}
