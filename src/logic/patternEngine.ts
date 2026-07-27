import { getPatternRule } from '../config/patternConfig';

import { CommitDecision, IntensityLevel, PatternName } from '../config/types';
import { DateIterator, DateIteratorOptions } from './dateIterator';
import { DayOfWeekFilter } from './dayOfWeekFilter';

export interface PatternEngineOptions extends DateIteratorOptions {
  pattern?: PatternName;
  intensity?: IntensityLevel;
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

  constructor(options: PatternEngineOptions = {}) {
    this.patternName = options.pattern ?? 'all-but-sat';
    this.intensity = options.intensity ?? 2;
    const rule = getPatternRule(this.patternName);

    this.iterator = new DateIterator(options);
    this.filter = new DayOfWeekFilter(rule, this.intensity);
  }

  /**
   * Generates the complete procedural contribution plan.
   */
  public generatePlan(): PatternPlanSummary {
    const decisions: CommitDecision[] = [];
    let activeDays = 0;
    let skippedDays = 0;
    let totalCommitsPlanned = 0;

    for (const date of this.iterator) {
      const decision = this.filter.evaluateDate(date);
      decisions.push(decision);

      if (decision.shouldCommit) {
        activeDays++;
        totalCommitsPlanned += decision.plannedCommits;
      } else {
        skippedDays++;
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
