import { PatternPlanSummary } from '../logic/patternEngine';

/**
 * Visual CLI Logger & Activity Grid Renderer
 */

export class Logger {
  public static log(msg: string): void {
    console.log(msg);
  }

  public static info(msg: string): void {
    console.log(`[INFO] ${msg}`);
  }

  public static success(msg: string): void {
    console.log(`[SUCCESS] ${msg}`);
  }

  public static warn(msg: string): void {
    console.warn(`[WARN] ${msg}`);
  }

  public static error(msg: string): void {
    console.error(`[ERROR] ${msg}`);
  }

  public static skip(dateStr: string, dayName: string, reason: string): void {
    console.log(`[SKIP] ${dateStr} (${dayName}): 0 commits generated -> ${reason}`);
  }

  public static commit(dateStr: string, dayName: string, count: number): void {
    console.log(`[COMMIT] ${dateStr} (${dayName}): Created ${count} deterministic commits`);
  }

  /**
   * Renders a 7-row x N-week ASCII Activity Grid to the console.
   */
  public static renderGrid(summary: PatternPlanSummary): void {
    const rowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid: string[][] = Array.from({ length: 7 }, () => []);

    // Group decisions by week
    for (const decision of summary.decisions) {
      const char = decision.shouldCommit ? '■' : '·';
      grid[decision.dayOfWeek].push(char);
    }

    console.log('\n===============================================================');
    console.log(` COMMIT CANVAS ACTIVITY GRID PREVIEW (${summary.patternName.toUpperCase()})`);
    console.log('===============================================================\n');

    for (let r = 0; r < 7; r++) {
      const label = rowLabels[r];
      const cells = grid[r].join('');
      // Highlight Saturday row specifically
      const isSat = (r === 6);
      const rowDisplay = isSat ? `${label} | ${cells}  (SKIPPED)` : `${label} | ${cells}`;
      console.log(rowDisplay);
    }

    console.log('\n---------------------------------------------------------------');
    console.log(` Timeline Range : ${summary.startDateStr} to ${summary.endDateStr}`);
    console.log(` Total Days     : ${summary.totalDays} days (${summary.totalDays / 7} weeks)`);
    console.log(` Active Days    : ${summary.activeDays} days (Sun-Fri)`);
    console.log(` Skipped Days   : ${summary.skippedDays} Saturdays`);
    console.log(` Intensity      : Level ${summary.intensity} (${summary.totalCommitsPlanned / summary.activeDays} commits/active day)`);
    console.log(` Total Commits  : ${summary.totalCommitsPlanned} commits`);
    console.log('===============================================================\n');
  }
}
