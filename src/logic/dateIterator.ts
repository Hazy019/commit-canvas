import { addDaysUTC, formatDateUTC, getUTCDayOfWeek, parseDateUTC } from '../utils/timezone';

export interface DateIteratorOptions {
  weeks?: number; // Default 52
  endDateStr?: string; // Default today UTC
}

/**
 * Procedural Date Iterator that generates a continuous daily timeline
 * aligned to a Sunday-Saturday 7-row grid over the specified number of weeks.
 */
export class DateIterator implements Iterable<Date> {
  private startDate: Date;
  private endDate: Date;

  constructor(options: DateIteratorOptions = {}) {
    const totalWeeks = options.weeks ?? 52;
    const end = options.endDateStr ? parseDateUTC(options.endDateStr) : new Date();

    // Normalize endDate to UTC 12:00:00
    const endDateUTC = parseDateUTC(formatDateUTC(end));

    // Align start date to a Sunday totalWeeks ago
    // Total days in N weeks = N * 7
    const daysBack = (totalWeeks * 7) - 1;
    let startCandidate = addDaysUTC(endDateUTC, -daysBack);

    // Adjust start candidate to preceding Sunday if needed for grid alignment
    const dayOfWeek = getUTCDayOfWeek(startCandidate);
    if (dayOfWeek !== 0) {
      startCandidate = addDaysUTC(startCandidate, -dayOfWeek);
    }

    this.startDate = startCandidate;
    this.endDate = endDateUTC;
  }

  public getStartEndDates(): { startDateStr: string; endDateStr: string; totalDays: number } {
    const totalDays = Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return {
      startDateStr: formatDateUTC(this.startDate),
      endDateStr: formatDateUTC(this.endDate),
      totalDays,
    };
  }

  public *[Symbol.iterator](): Iterator<Date> {
    let current = new Date(this.startDate.getTime());
    while (current.getTime() <= this.endDate.getTime()) {
      yield new Date(current.getTime());
      current = addDaysUTC(current, 1);
    }
  }

  public getDatesArray(): Date[] {
    return Array.from(this);
  }
}
