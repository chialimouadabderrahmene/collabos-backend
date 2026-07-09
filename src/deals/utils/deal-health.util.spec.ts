import { DealStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeDealHealth } from './deal-health.util';

describe('computeDealHealth', () => {
  it('is CANCELLED for a cancelled deal regardless of dates', () => {
    const health = computeDealHealth(
      { status: DealStatus.CANCELLED, endDate: new Date('2020-01-01') },
      [],
    );
    expect(health).toBe('CANCELLED');
  });

  it('is COMPLETED for a completed deal regardless of dates', () => {
    const health = computeDealHealth(
      { status: DealStatus.COMPLETED, endDate: new Date('2020-01-01') },
      [{ dueDate: new Date('2020-01-01'), isCompleted: false }],
    );
    expect(health).toBe('COMPLETED');
  });

  it('is OVERDUE when the deal end date has passed', () => {
    const health = computeDealHealth(
      { status: DealStatus.ACTIVE, endDate: new Date('2020-01-01') },
      [],
    );
    expect(health).toBe('OVERDUE');
  });

  it('is AT_RISK when a milestone is overdue but the deal end date has not passed', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);

    const health = computeDealHealth(
      { status: DealStatus.ACTIVE, endDate: future },
      [{ dueDate: past, isCompleted: false }],
    );
    expect(health).toBe('AT_RISK');
  });

  it('ignores completed milestones when checking for overdue risk', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);

    const health = computeDealHealth(
      { status: DealStatus.ACTIVE, endDate: future },
      [{ dueDate: past, isCompleted: true }],
    );
    expect(health).toBe('ON_TRACK');
  });

  it('is ON_TRACK when nothing is overdue', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    const health = computeDealHealth(
      { status: DealStatus.NEGOTIATING, endDate: null },
      [{ dueDate: future, isCompleted: false }],
    );
    expect(health).toBe('ON_TRACK');
  });
});
