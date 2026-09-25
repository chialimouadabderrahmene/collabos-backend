import { IEvent } from '@nestjs/cqrs';

export const OPPORTUNITY_PUBLISHED_EVENT_TYPE = 'opportunity.published';

export interface OpportunityPublishedPayload {
  opportunityId: string;
  brandId: string;
  versionId: string;
  versionNumber: number;
  publishedById: string;
  title: string;
}

export class OpportunityPublishedEvent implements IEvent {
  constructor(public readonly payload: OpportunityPublishedPayload) {}
}
