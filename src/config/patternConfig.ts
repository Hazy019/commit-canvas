import { IntensityLevel, PatternName, PatternRuleConfig } from './types';

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const INTENSITY_COMMIT_MAP: Record<IntensityLevel, number> = {
  1: 5,
  2: 25,
  3: 30,
  4: 48,
};

export const INTENSITY_COMMIT_RANGE_MAP: Record<IntensityLevel, { min: number; max: number }> = {
  1: { min: 0, max: 10 },  // Organic light spectrum with rest days: 0 to 10 commits (~35% rest days)
  2: { min: 0, max: 3 },   // Minimal organic spectrum with rest days: 0 to 3 commits (~35% rest days)
  3: { min: 0, max: 55 },  // Organic moderate spectrum with rest days: 0 to 55 commits (~30% rest days)
  4: { min: 0, max: 80 },  // Organic peak spectrum with rest days: 0 to 80 commits (~25% rest days)
};

export function getSeededRandomCommitCount(dateStr: string, intensity: IntensityLevel): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  if (intensity === 1) {
    // Level 1: 0-10 commits with high rest day probability (~35%)
    const roll = positiveHash % 100;
    if (roll < 35) {
      // Tier 0 (Rest Day / Empty): 0 commits (~35% of days)
      return 0;
    } else if (roll < 75) {
      // Tier 1 (Light Green / 1-4 commits): (~40% of days)
      return 1 + (positiveHash % 4);
    } else if (roll < 90) {
      // Tier 2 (Medium Green / 5-7 commits): (~15% of days)
      return 5 + (positiveHash % 3);
    } else {
      // Tier 3 (Peak Light / 8-10 commits): (~10% of days)
      return 8 + (positiveHash % 3);
    }
  }

  if (intensity === 2) {
    // Level 2: 0-3 commits with high rest day probability (~35%)
    const roll = positiveHash % 100;
    if (roll < 35) {
      // Tier 0 (Rest Day / Empty): 0 commits (~35% of days)
      return 0;
    } else if (roll < 65) {
      // Tier 1 (1 commit): (~30% of days)
      return 1;
    } else if (roll < 85) {
      // Tier 2 (2 commits): (~20% of days)
      return 2;
    } else {
      // Tier 3 (3 commits): (~15% of days)
      return 3;
    }
  }

  if (intensity === 3) {
    // Level 3: 0-55 commits with high rest day probability (~30%)
    const roll = positiveHash % 100;
    if (roll < 30) {
      // Tier 0 (Rest Day / Empty): 0 commits (~30% of days)
      return 0;
    } else if (roll < 60) {
      // Tier 1 (Light Green): 1 - 12 commits (~30% of days)
      return 1 + (positiveHash % 12);
    } else if (roll < 85) {
      // Tier 2 (Medium Green): 13 - 28 commits (~25% of days)
      return 13 + (positiveHash % 16);
    } else if (roll < 93) {
      // Tier 3 (Dark Green): 29 - 42 commits (~8% of days)
      return 29 + (positiveHash % 14);
    } else {
      // Tier 4 (Peak Moderate Sprint): 43 - 55 commits (~7% of days)
      return 43 + (positiveHash % 13);
    }
  }

  if (intensity === 4) {
    // Level 4: 0-80 commits with high rest day probability (~25%) (capped at 80 to preserve 85-commit peak)
    const roll = positiveHash % 100;
    if (roll < 25) {
      // Tier 0 (Rest Day / Empty): 0 commits (~25% of days)
      return 0;
    } else if (roll < 55) {
      // Tier 1 (Light Green): 1 - 15 commits (~30% of days)
      return 1 + (positiveHash % 15);
    } else if (roll < 80) {
      // Tier 2 (Medium Green): 16 - 45 commits (~25% of days)
      return 16 + (positiveHash % 30);
    } else if (roll < 92) {
      // Tier 3 (Dark Green): 46 - 70 commits (~12% of days)
      return 46 + (positiveHash % 25);
    } else {
      // Tier 4 (Peak Heavy Sprint): 71 - 80 commits (~8% of days)
      return 71 + (positiveHash % 10);
    }
  }

  return 5;
}

export const PATTERN_RULES: Record<PatternName, PatternRuleConfig> = {
  'all-but-sat': {
    name: 'all-but-sat',
    description: 'Generates contributions Sun-Fri and strictly skips Saturday.',
    intensityCommitMap: INTENSITY_COMMIT_MAP,
    shouldCommitDay: (dayOfWeek: number): boolean => {
      // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
      return dayOfWeek !== 6;
    },
  },
};

export function getPatternRule(name: PatternName = 'all-but-sat'): PatternRuleConfig {
  const rule = PATTERN_RULES[name];
  if (!rule) {
    throw new Error(`Unknown pattern rule: ${name}`);
  }
  return rule;
}
