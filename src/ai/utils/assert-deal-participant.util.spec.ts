import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertDealParticipant } from './assert-deal-participant.util';

function buildDeal(
  overrides: Partial<{ creatorId: string; brand: { ownerId: string } }> = {},
) {
  return {
    creatorId: 'creator-1',
    brand: { ownerId: 'owner-1' },
    ...overrides,
  };
}

describe('assertDealParticipant', () => {
  it('allows the deal creator', () => {
    expect(() =>
      assertDealParticipant(buildDeal(), {
        id: 'creator-1',
        roles: ['USER'],
      } as never),
    ).not.toThrow();
  });

  it('allows the brand owner', () => {
    expect(() =>
      assertDealParticipant(buildDeal(), {
        id: 'owner-1',
        roles: ['USER'],
      } as never),
    ).not.toThrow();
  });

  it('allows an admin', () => {
    expect(() =>
      assertDealParticipant(buildDeal(), {
        id: 'admin-1',
        roles: ['ADMIN'],
      } as never),
    ).not.toThrow();
  });

  it('rejects an unrelated user', () => {
    expect(() =>
      assertDealParticipant(buildDeal(), {
        id: 'stranger',
        roles: ['USER'],
      } as never),
    ).toThrow(ForbiddenException);
  });
});
