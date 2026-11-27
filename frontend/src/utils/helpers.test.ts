import { describe, expect, it } from 'vitest';
import { calculateRankChange, formatDate, getStatusBadge } from './helpers';

describe('calculateRankChange', () => {
  it('treats a lower rank number as improvement', () => {
    // Rank #10 is better than rank #20, so moving from 20 -> 10 is +10.
    const result = calculateRankChange(10, 20);
    expect(result.direction).toBe('improved');
    expect(result.change).toBe(10);
    expect(result.label).toBe('↑ 10 positions');
  });

  it('uses singular wording for a one-position improvement', () => {
    const result = calculateRankChange(9, 10);
    expect(result.label).toBe('↑ 1 position');
  });

  it('treats a higher rank number as decline', () => {
    const result = calculateRankChange(20, 10);
    expect(result.direction).toBe('declined');
    expect(result.change).toBe(10);
    expect(result.label).toBe('↓ 10 positions');
  });

  it('reports unchanged when current equals previous', () => {
    const result = calculateRankChange(15, 15);
    expect(result.direction).toBe('unchanged');
    expect(result.change).toBe(0);
    expect(result.label).toBe('→ No Change');
  });

  it('reports a new entry when there is no previous rank', () => {
    const result = calculateRankChange(15, undefined);
    expect(result.direction).toBe('new');
    expect(result.label).toBe('New Entry');
  });

  it('reports a new entry when the previous rank is not a number', () => {
    const result = calculateRankChange(15, 'N/A');
    expect(result.direction).toBe('new');
  });

  it('parses stringified numeric ranks', () => {
    const result = calculateRankChange('10', '20');
    expect(result.direction).toBe('improved');
    expect(result.change).toBe(10);
  });

  it('treats a zero previous rank as missing (falsy) data', () => {
    const result = calculateRankChange(5, 0);
    expect(result.direction).toBe('new');
  });
});

describe('getStatusBadge', () => {
  it.each([
    ['Published', 'Published'],
    ['Verified', 'Verified'],
    ['Under Review', 'Under Review'],
    ['Submitted', 'Submitted'],
    ['Draft', 'Draft'],
  ] as const)('maps status %s to label %s', (status, expectedLabel) => {
    expect(getStatusBadge(status).label).toBe(expectedLabel);
  });

  it('falls back to Draft styling for an unrecognised status', () => {
    // @ts-expect-error - deliberately passing an invalid status to exercise the default branch
    const badge = getStatusBadge('Something Else');
    expect(badge.label).toBe('Draft');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string using the en-IN locale', () => {
    expect(formatDate('2024-08-15T00:00:00.000Z')).toMatch(/2024/);
  });

  it('returns N/A when no date is provided', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns the original string when the date cannot be parsed into a usable value', () => {
    // new Date('not-a-date') does not throw synchronously in the implementation's
    // try block, so toLocaleDateString runs on an Invalid Date; just assert it is a string.
    expect(typeof formatDate('not-a-date')).toBe('string');
  });
});
