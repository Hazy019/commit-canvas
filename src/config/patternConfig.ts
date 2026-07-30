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
  1: 1,
  2: 5,
  3: 10,
  4: 15,
};

export const INTENSITY_COMMIT_RANGE_MAP: Record<IntensityLevel, { min: number; max: number }> = {
  1: { min: 2, max: 8 },
  2: { min: 5, max: 35 },  // Organic human spectrum: 5 to 35 commits
  3: { min: 12, max: 45 },
  4: { min: 20, max: 60 },
};

export function getSeededRandomCommitCount(dateStr: string, intensity: IntensityLevel): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  if (intensity === 2) {
    // 4-tier organic distribution for Level 2 (5-35 commits) to populate all 4 green shades on GitHub
    const roll = positiveHash % 100;
    if (roll < 20) {
      // Tier 1 (Light / Dark Green): 5 - 10 commits (~20% of days)
      return 5 + (positiveHash % 6);
    } else if (roll < 65) {
      // Tier 2 (Moderate / Medium Green): 11 - 20 commits (~45% of days)
      return 11 + (positiveHash % 10);
    } else if (roll < 90) {
      // Tier 3 (Heavy / Light Green): 21 - 28 commits (~25% of days)
      return 21 + (positiveHash % 8);
    } else {
      // Tier 4 (Peak Sprint / Bright Lime Green): 29 - 35 commits (~10% of days)
      return 29 + (positiveHash % 7);
    }
  }

  const range = INTENSITY_COMMIT_RANGE_MAP[intensity] || { min: 5, max: 35 };
  const diff = range.max - range.min + 1;
  return range.min + (positiveHash % diff);
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
