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
  3: 45,
  4: 48,
};

export const INTENSITY_COMMIT_RANGE_MAP: Record<IntensityLevel, { min: number; max: number }> = {
  1: { min: 2, max: 10 },
  2: { min: 5, max: 60 },  // Organic human spectrum: 5 to 60 commits
  3: { min: 15, max: 80 },
  4: { min: 0, max: 80 },  // Organic spectrum with rest days: 0 to 80 commits (preserving 85-commit organic peak)
};

export function getSeededRandomCommitCount(dateStr: string, intensity: IntensityLevel): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  if (intensity === 2) {
    // 4-tier organic distribution for Level 2 (5-60 commits) to populate all 4 green shades on GitHub
    const roll = positiveHash % 100;
    if (roll < 20) {
      // Tier 1 (Light Green / Shade 1): 5 - 12 commits (~20% of days)
      return 5 + (positiveHash % 8);
    } else if (roll < 65) {
      // Tier 2 (Medium Green / Shade 2): 13 - 25 commits (~45% of days)
      return 13 + (positiveHash % 13);
    } else if (roll < 90) {
      // Tier 3 (Darker Green / Shade 3): 26 - 42 commits (~25% of days)
      return 26 + (positiveHash % 17);
    } else {
      // Tier 4 (Peak Sprint / Darkest Lime Green): 43 - 60 commits (~10% of days)
      return 43 + (positiveHash % 18);
    }
  }

  if (intensity === 4) {
    // 5-tier organic distribution for Level 4 (0-80 commits) including zero-commit rest days (capped at 80 to preserve 85-commit peak)
    const roll = positiveHash % 100;
    if (roll < 15) {
      // Tier 0 (Rest Day / Empty): 0 commits (~15% of days)
      return 0;
    } else if (roll < 40) {
      // Tier 1 (Light Green): 1 - 15 commits (~25% of days)
      return 1 + (positiveHash % 15);
    } else if (roll < 75) {
      // Tier 2 (Medium Green): 16 - 45 commits (~35% of days)
      return 16 + (positiveHash % 30);
    } else if (roll < 90) {
      // Tier 3 (Dark Green): 46 - 70 commits (~15% of days)
      return 46 + (positiveHash % 25);
    } else {
      // Tier 4 (Peak Heavy Sprint): 71 - 80 commits (~10% of days, strictly below 85 peak)
      return 71 + (positiveHash % 10);
    }
  }

  const range = INTENSITY_COMMIT_RANGE_MAP[intensity] || { min: 5, max: 60 };
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
