import { z } from 'zod';

/**
 * F26B-7: rules for the query string of GET /api/summary/monthly, e.g. ?month=2026-11
 * Leaving month out means the current month (in UTC).
 */
export const monthlySummaryQuerySchema = z.object({
  month: z
    .string({ invalid_type_error: 'Month must be a single value' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-11 (year-month)')
    .optional()
});

/** The current month as "YYYY-MM", in UTC (transaction dates are stored in UTC). */
export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * The first moment of the month and the first moment of the next month, in UTC.
 * A transaction is in the month when start <= date < end, so nothing on the edges is counted twice or missed.
 */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  // Date.UTC months are 0-based, so monthNumber - 1 is this month and monthNumber is the next one.
  // Date.UTC(2026, 12, 1) correctly rolls over to January 2027.
  return { start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 1)) };
}
