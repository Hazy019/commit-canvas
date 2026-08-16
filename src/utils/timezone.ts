/**
 * Utilities for strict UTC date handling and formatting.
 * Prevents timezone offset shifts from altering day-of-week logic.
 */

/**
 * Formats a Date object into a YYYY-MM-DD string in UTC.
 */
export function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object normalized to 12:00:00 UTC.
 * Using 12:00:00 UTC prevents edge boundary issues across calendar calculations.
 */
export function parseDateUTC(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

/**
 * Generates an ISO 8601 timestamp string in UTC for a specific commit index.
 * e.g., 2026-07-27 -> 2026-07-27T12:05:00Z for index 5.
 */
export function createCommitTimestampUTC(dateStr: string, commitIndex: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  // Stagger commit timestamps slightly by minutes based on index (e.g. 12:01, 12:02)
  const minutes = (commitIndex % 60);
  const date = new Date(Date.UTC(year, month, day, 12, minutes, 0, 0));
  return date.toISOString();
}

/**
 * Generates an organic human-like circadian timestamp during typical developer active hours (09:00 - 22:30 UTC).
 * Distributes commits throughout the day with non-linear Poisson-like micro-jitter.
 */
export function createHumanCommitTimestampUTC(dateStr: string, commitIndex: number, totalCommits: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Spread across active span: 09:00 (9.0) to 22:00 (22.0)
  const startHour = 9;
  const endHour = 22;
  const totalSpanHours = endHour - startHour; // 13 hours span

  // Linear progression baseline with pseudo-random seed jitter per commit
  const progressRatio = totalCommits <= 1 ? 0.5 : (commitIndex - 1) / (totalCommits - 1);
  const baseHourOffset = progressRatio * totalSpanHours;

  // Jitter based on date and index seed
  const seed = (year * 365 + (month + 1) * 31 + day * 17 + commitIndex * 73) % 1000;
  const minuteJitter = (seed % 45); // 0 to 44 minutes jitter
  const secondJitter = (seed % 59);

  let hour = Math.floor(startHour + baseHourOffset);
  let minute = minuteJitter;
  let second = secondJitter;

  // Ensure hour stays strictly within calendar day UTC bounds (0 - 23)
  if (hour > 23) hour = 23;
  if (hour < 0) hour = 0;

  const date = new Date(Date.UTC(year, month, day, hour, minute, second, 0));
  return date.toISOString();
}

/**
 * Returns the day of week (0=Sunday ... 6=Saturday) in UTC for a given Date.
 */
export function getUTCDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/**
 * Adds an integer number of days to a Date in UTC.
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
