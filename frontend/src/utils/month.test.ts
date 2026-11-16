import { describe, expect, test } from 'vitest';
import { currentMonth, formatMonth, shiftMonth } from './month.ts';

// F26B-7: month helpers.

describe('currentMonth', () => {
  test('formats a date as YYYY-MM with a leading zero', () => {
    expect(currentMonth(new Date(2026, 2, 15))).toBe('2026-03');
  });
});

describe('shiftMonth', () => {
  test('moves forward and back within a year', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
  });

  test('rolls over the year in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('formatMonth', () => {
  test('writes the month name and year', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatMonth('2025-01')).toBe('January 2025');
  });
});
