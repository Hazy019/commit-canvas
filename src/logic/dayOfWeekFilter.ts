import { DAY_NAMES, evaluateMarkovDecision, getSeededRandomCommitCount } from '../config/patternConfig';
import { CommitDecision, CommitInfo, IntensityLevel, PatternRuleConfig } from '../config/types';
import { createHumanCommitTimestampUTC, formatDateUTC, getUTCDayOfWeek } from '../utils/timezone';

/**
 * Procedural Day-of-Week & Markov Filter Engine.
 * Evaluates dates against pattern rule filters, Markov state bounds, and circadian distribution.
 */
export class DayOfWeekFilter {
  private rule: PatternRuleConfig;
  private intensity: IntensityLevel;
  private excludeDatesSet: Set<string>;

  constructor(
    rule: PatternRuleConfig,
    intensity: IntensityLevel = 2,
    excludeDates: string[] = []
  ) {
    this.rule = rule;
    this.intensity = intensity;
    this.excludeDatesSet = new Set(excludeDates.map((d) => d.trim()));
  }

  /**
   * Evaluates a single Date object to determine whether to execute
   * the "Generate Commits" path or the "Skip Day" path.
   *
   * @param date Target UTC date
   * @param daysSinceLastCommit Days elapsed since the previous commit (for Markov state evaluation)
   */
  public evaluateDate(date: Date, daysSinceLastCommit?: number): CommitDecision {
    const dayOfWeek = getUTCDayOfWeek(date);
    const dayName = DAY_NAMES[dayOfWeek];
    const dateStr = formatDateUTC(date); // YYYY-MM-DD
    const monthDayStr = dateStr.substring(5); // MM-DD

    // 1. EXPLICIT PEAK PRESERVATION DATE EXCLUSION CHECK
    if (this.excludeDatesSet.has(dateStr) || this.excludeDatesSet.has(monthDayStr)) {
      return {
        dateStr,
        date,
        dayOfWeek,
        dayName,
        shouldCommit: false,
        plannedCommits: 0,
        commits: [],
        daysSinceLastCommit,
        skipReason: `Peak preservation: date '${dateStr}' is in explicit exclusion list`,
      };
    }

    // 2. DAY OF WEEK RULE CHECK (e.g. All-but-Sat)
    const shouldCommitDayOfWeek = this.rule.shouldCommitDay(dayOfWeek);
    if (!shouldCommitDayOfWeek) {
      return {
        dateStr,
        date,
        dayOfWeek,
        dayName,
        shouldCommit: false,
        plannedCommits: 0,
        commits: [],
        daysSinceLastCommit,
        skipReason: `Filter rule '${this.rule.name}': ${dayName} (day index ${dayOfWeek}) is filtered out`,
      };
    }

    // 3. MARKOV STATE TRANSITION EVALUATION (if state provided)
    if (typeof daysSinceLastCommit === 'number') {
      const markov = evaluateMarkovDecision(dateStr, daysSinceLastCommit);
      if (!markov.shouldCommit) {
        return {
          dateStr,
          date,
          dayOfWeek,
          dayName,
          shouldCommit: false,
          plannedCommits: 0,
          commits: [],
          daysSinceLastCommit,
          skipReason: markov.skipReason || 'Markov state rest day',
        };
      }
    }

    // 4. GENERATE ACTIVE COMMITS (Guaranteed >= 1 commit on active days)
    const commitCount = getSeededRandomCommitCount(dateStr, this.intensity);

    const commits: CommitInfo[] = [];
    for (let i = 1; i <= commitCount; i++) {
      const timestampIso = createHumanCommitTimestampUTC(dateStr, i, commitCount);
      const signature = `[commit-canvas-filter:${dateStr}:${dayName.toLowerCase()}:${i}/${commitCount}]`;
      commits.push({
        dateStr,
        timestampIso,
        signature,
        index: i,
        totalForDay: commitCount,
      });
    }

    return {
      dateStr,
      date,
      dayOfWeek,
      dayName,
      shouldCommit: true,
      plannedCommits: commitCount,
      commits,
      daysSinceLastCommit,
    };
  }
}
