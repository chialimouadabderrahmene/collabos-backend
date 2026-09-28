import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { NotificationType } from '@prisma/client';
import { DomainEventRegistry } from '../../events/domain-event-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OPPORTUNITY_PUBLISHED_EVENT_TYPE,
  OpportunityPublishedEvent,
  OpportunityPublishedPayload,
} from './opportunity-published.event';

export const OPPORTUNITY_PUBLISHED_TEMPLATE_KEY = 'opportunity.published';

/**
 * Notifies the brand team (in-app) that a new version was published.
 * Follows the outbox handler contract (ADR 0002): never throws, and is safe
 * under redelivery — members already notified for this version are skipped.
 */
@Injectable()
@EventsHandler(OpportunityPublishedEvent)
export class OpportunityPublishedHandler implements IEventHandler<OpportunityPublishedEvent> {
  private readonly logger = new Logger(OpportunityPublishedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    registry: DomainEventRegistry,
  ) {
    registry.register(
      OPPORTUNITY_PUBLISHED_EVENT_TYPE,
      (payload) =>
        new OpportunityPublishedEvent(
          payload as unknown as OpportunityPublishedPayload,
        ),
    );
  }

  async handle(event: OpportunityPublishedEvent): Promise<void> {
    const { payload } = event;
    try {
      const members = await this.prisma.brandMember.findMany({
        where: {
          brandId: payload.brandId,
          userId: { not: payload.publishedById },
        },
        select: { userId: true },
      });
      if (members.length === 0) {
        return;
      }

      const alreadyNotified = await this.prisma.notification.findMany({
        where: {
          templateKey: OPPORTUNITY_PUBLISHED_TEMPLATE_KEY,
          userId: { in: members.map((member) => member.userId) },
          metadata: { path: ['versionId'], equals: payload.versionId },
        },
        select: { userId: true },
      });
      const skip = new Set(alreadyNotified.map((row) => row.userId));
      const recipients = members.filter((member) => !skip.has(member.userId));

      if (recipients.length === 0) {
        return;
      }

      await this.prisma.notification.createMany({
        data: recipients.map((member) => ({
          userId: member.userId,
          type: NotificationType.GENERIC,
          templateKey: OPPORTUNITY_PUBLISHED_TEMPLATE_KEY,
          title: 'Opportunity published',
          message: `"${payload.title}" was published as version ${payload.versionNumber}.`,
          metadata: {
            opportunityId: payload.opportunityId,
            versionId: payload.versionId,
            versionNumber: payload.versionNumber,
          },
        })),
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify brand team for opportunity ${payload.opportunityId} v${payload.versionNumber}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
