import { getPatternRule } from '../config/patternConfig';
import { CommitDecision, IntensityLevel, PatternName } from '../config/types';
import { DateIterator, DateIteratorOptions } from './dateIterator';
import { DayOfWeekFilter } from './dayOfWeekFilter';

export interface PatternEngineOptions extends DateIteratorOptions {
  pattern?: PatternName;
  intensity?: IntensityLevel;
  excludeDates?: string[];
  useMarkov?: boolean;
  initialDaysSinceLastCommit?: number;
}

export interface PatternPlanSummary {
  patternName: PatternName;
  intensity: IntensityLevel;
  startDateStr: string;
  endDateStr: string;
  totalDays: number;
  activeDays: number;
  skippedDays: number;
  totalCommitsPlanned: number;
  decisions: CommitDecision[];
}

export class PatternEngine {
  private iterator: DateIterator;
  private filter: DayOfWeekFilter;
  private patternName: PatternName;
  private intensity: IntensityLevel;
  private useMarkov: boolean;
  private initialDaysSinceLastCommit: number;

  constructor(options: PatternEngineOptions = {}) {
    this.patternName = options.pattern ?? 'all-but-sat';
    this.intensity = options.intensity ?? 2;
    this.useMarkov = options.useMarkov ?? true;
    this.initialDaysSinceLastCommit = options.initialDaysSinceLastCommit ?? 1;

    const rule = getPatternRule(this.patternName);
    this.iterator = new DateIterator(options);
    this.filter = new DayOfWeekFilter(rule, this.intensity, options.excludeDates);
  }

  /**
   * Generates the complete procedural contribution plan with sequential Markov state tracking.
   */
  public generatePlan(): PatternPlanSummary {
    const decisions: CommitDecision[] = [];
    let activeDays = 0;
    let skippedDays = 0;
    let totalCommitsPlanned = 0;

    let rollingDaysSinceLastCommit = this.initialDaysSinceLastCommit;

    for (const date of this.iterator) {
      const decision = this.filter.evaluateDate(
        date,
        this.useMarkov ? rollingDaysSinceLastCommit : undefined
      );

      decisions.push(decision);

      if (decision.shouldCommit) {
        activeDays++;
        totalCommitsPlanned += decision.plannedCommits;
        rollingDaysSinceLastCommit = 1; // Reset counter for the next consecutive day
      } else {
        skippedDays++;
        rollingDaysSinceLastCommit++; // Increment inactivity delta
      }
    }

    const { startDateStr, endDateStr, totalDays } = this.iterator.getStartEndDates();

    return {
      patternName: this.patternName,
      intensity: this.intensity,
      startDateStr,
      endDateStr,
      totalDays,
      activeDays,
      skippedDays,
      totalCommitsPlanned,
      decisions,
    };
  }
}
