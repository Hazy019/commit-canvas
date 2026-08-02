/**
 * Type definitions for commit-canvas-filter engine.
 */

export type IntensityLevel = 1 | 2 | 3 | 4;

export type PatternName = 'all-but-sat';

export interface PatternRuleConfig {
  name: PatternName;
  description: string;
  intensityCommitMap: Record<IntensityLevel, number>;
  /**
   * Day of week filter function.
   * Day of week follows standard 0-6 indexing (0 = Sunday, 6 = Saturday).
   * Returns true if commits should be generated for this day of week.
   */
  shouldCommitDay: (dayOfWeek: number) => boolean;
}

export interface CommitInfo {
  dateStr: string; // YYYY-MM-DD
  timestampIso: string; // ISO 8601 UTC timestamp
  signature: string; // e.g. [commit-canvas-filter:YYYY-MM-DD:weekday:idx/total]
  index: number; // 1-based index for the day's commits
  totalForDay: number;
}

export interface CommitDecision {
  dateStr: string; // YYYY-MM-DD
  date: Date; // UTC Date object
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  dayName: string; // "Sunday", "Monday", ..., "Saturday"
  shouldCommit: boolean;
  plannedCommits: number;
  commits: CommitInfo[];
  skipReason?: string;
}

export interface PreviewOptions {
  weeks?: number;
  intensity?: IntensityLevel;
  pattern?: PatternName;
  startDate?: string; // YYYY-MM-DD override (e.g. 2026-01-01)
  endDate?: string; // YYYY-MM-DD override
  excludeDates?: string[]; // Array of YYYY-MM-DD or MM-DD strings to preserve peak organic dates
}

export interface SyncOptions {
  weeks?: number;
  intensity?: IntensityLevel;
  pattern?: PatternName;
  dryRun?: boolean;
  startDate?: string; // YYYY-MM-DD override (e.g. 2026-01-01)
  endDate?: string; // YYYY-MM-DD override
  excludeDates?: string[]; // Array of YYYY-MM-DD or MM-DD strings to preserve peak organic dates
  branch?: string;
}

export interface VerifyOptions {
  pattern?: PatternName;
  branch?: string;
  maxCommits?: number;
}

export interface VerificationResult {
  success: boolean;
  patternName: PatternName;
  totalCommitsScanned: number;
  matchingCanvasCommits: number;
  saturdayCommitsFound: number;
  violatingCommits: Array<{ hash: string; dateStr: string; message: string }>;
  summary: string;
}
