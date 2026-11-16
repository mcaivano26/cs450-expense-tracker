// F26B-7: helpers for months written as "YYYY-MM" (the format the API uses).

/** This month as "YYYY-MM", in the user's own time zone. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Moves a month forward or back: shiftMonth('2026-01', -1) is '2025-12'. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  // Date.UTC handles the year rollover (month 0 of 2026 is December 2025, month 12 is January of next year).
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return shifted.toISOString().slice(0, 7);
}

/** "2026-11" as "November 2026". */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}
