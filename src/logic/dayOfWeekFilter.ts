import { DAY_NAMES, PATTERN_RULES, getSeededRandomCommitCount } from '../config/patternConfig';
import { CommitDecision, CommitInfo, IntensityLevel, PatternRuleConfig } from '../config/types';
import { createCommitTimestampUTC, formatDateUTC, getUTCDayOfWeek } from '../utils/timezone';

/**
 * Procedural Day-of-Week Filter Engine.
 * Evaluates each single date against the pattern rule filter.
 */
export class DayOfWeekFilter {
  private rule: PatternRuleConfig;
  private intensity: IntensityLevel;

  constructor(rule: PatternRuleConfig, intensity: IntensityLevel = 2) {
    this.rule = rule;
    this.intensity = intensity;
  }

  /**
   * Evaluates a single Date object to determine whether to execute
   * the "Generate Commits" path or the "Skip Day" path.
   */
  public evaluateDate(date: Date): CommitDecision {
    const dayOfWeek = getUTCDayOfWeek(date);
    const dayName = DAY_NAMES[dayOfWeek];
    const dateStr = formatDateUTC(date);

    const shouldCommit = this.rule.shouldCommitDay(dayOfWeek);

    if (!shouldCommit) {
      // SKIP DAY PATH
      return {
        dateStr,
        date,
        dayOfWeek,
        dayName,
        shouldCommit: false,
        plannedCommits: 0,
        commits: [],
        skipReason: `Filter rule '${this.rule.name}': ${dayName} (day index ${dayOfWeek}) is filtered out`,
      };
    }

    // GENERATE COMMITS PATH
    const commitCount = getSeededRandomCommitCount(dateStr, this.intensity);
    const commits: CommitInfo[] = [];

    for (let i = 1; i <= commitCount; i++) {
      const timestampIso = createCommitTimestampUTC(dateStr, i);
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
    };
  }
}
