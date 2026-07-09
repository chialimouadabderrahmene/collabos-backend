import { DealStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeDealHealthScore } from './deal-health-score.util';

describe('computeDealHealthScore', () => {
  it('scores a cancelled deal at 0 with a single risk factor', () => {
    const result = computeDealHealthScore({
      status: DealStatus.CANCELLED,
      endDate: new Date('2020-01-01'),
      milestones: [],
    });

    expect(result).toEqual({ score: 0, riskFactors: ['Deal is cancelled'] });
  });

  it('scores a completed deal at 100 with no risk factors', () => {
    const result = computeDealHealthScore({
      status: DealStatus.COMPLETED,
      endDate: new Date('2020-01-01'),
      milestones: [{ dueDate: new Date('2020-01-01'), isCompleted: false }],
    });

    expect(result).toEqual({ score: 100, riskFactors: [] });
  });

  it('scores a healthy active deal near 100 with no risk factors', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const result = computeDealHealthScore({
      status: DealStatus.ACTIVE,
      endDate: future,
      milestones: [
        { dueDate: future, isCompleted: true },
        { dueDate: future, isCompleted: true },
      ],
    });

    expect(result.riskFactors).toEqual([]);
    expect(result.score).toBe(100);
  });

  it('penalizes a deal whose end date has passed', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const result = computeDealHealthScore({
      status: DealStatus.ACTIVE,
      endDate: past,
      milestones: [],
    });

    expect(result.riskFactors).toContain('Deal end date has passed');
    expect(result.score).toBeLessThan(100);
  });

  it('penalizes overdue milestones proportionally, capped at -40', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const result = computeDealHealthScore({
      status: DealStatus.ACTIVE,
      endDate: future,
      milestones: [
        { dueDate: past, isCompleted: false },
        { dueDate: past, isCompleted: false },
        { dueDate: past, isCompleted: false },
        { dueDate: past, isCompleted: false },
      ],
    });

    expect(result.riskFactors).toContain('4 milestone(s) overdue');
    expect(result.score).toBe(50);
  });

  it('flags a deal with no milestones defined', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const result = computeDealHealthScore({
      status: DealStatus.ACTIVE,
      endDate: future,
      milestones: [],
    });

    expect(result.riskFactors).toContain('No milestones defined');
  });

  it('never returns a score below 0 and stacks every risk factor for a maximally at-risk deal', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const result = computeDealHealthScore({
      status: DealStatus.ACTIVE,
      endDate: past,
      milestones: Array.from({ length: 10 }, () => ({
        dueDate: past,
        isCompleted: false,
      })),
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBe(10);
    expect(result.riskFactors).toEqual([
      'Deal end date has passed',
      '10 milestone(s) overdue',
    ]);
  });
});
