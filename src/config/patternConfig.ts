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
  2: 2,
  3: 30,
  4: 48,
};

export const INTENSITY_COMMIT_RANGE_MAP: Record<IntensityLevel, { min: number; max: number }> = {
  1: { min: 1, max: 10 },  // Guaranteed active minimum 1 to 10 commits
  2: { min: 1, max: 3 },   // Minimal spectrum: 1 to 3 commits
  3: { min: 1, max: 55 },  // Organic moderate spectrum: 1 to 55 commits
  4: { min: 1, max: 80 },  // Organic peak spectrum: 1 to 80 commits
};

/**
 * Two-pass avalanche hash seeder.
 *
 * Pass 1 (FNV-1a): produces a uniform `roll` value (0-99) for tier gates.
 * Pass 2 (Mulberry32-style mix): produces a fully independent `count` seed.
 */
export function seededHash(dateStr: string): { roll: number; count: number } {
  // Pass 1: FNV-1a over the date string
  let h = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
    h |= 0;
  }
  const seed1 = Math.abs(h);

  // Pass 2: Mulberry32-style finalizer for count independence
  let h2 = seed1 ^ 0xdeadbeef;
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x45d9f3b);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x45d9f3b);
  h2 = h2 ^ (h2 >>> 16);
  const seed2 = Math.abs(h2);

  return {
    roll: seed1 % 100, // uniform 0-99 for tier gate
    count: seed2,      // independent seed for commit count offset
  };
}

/**
 * Evaluates whether a given day should be an active commit day or a rest day
 * based on the Markov state transition matrix (bounded to max 3 days rest).
 */
export function evaluateMarkovDecision(
  dateStr: string,
  daysSinceLastCommit: number,
  maxRestDays: number = 3
): { shouldCommit: boolean; skipReason?: string } {
  // HARD CAP: If 3 or more days have elapsed since last commit, force wake up!
  if (daysSinceLastCommit >= maxRestDays) {
    return {
      shouldCommit: true,
    };
  }

  const { roll } = seededHash(dateStr);

  if (daysSinceLastCommit === 1) {
    // 75% chance to continue the active sprint; 25% chance to start a 1-day rest
    if (roll < 25) {
      return {
        shouldCommit: false,
        skipReason: 'Markov organic rest day (1/3)',
      };
    }
    return { shouldCommit: true };
  }

  if (daysSinceLastCommit === 2) {
    // 85% chance to resume working after 1 day rest; 15% chance to extend rest
    if (roll < 15) {
      return {
        shouldCommit: false,
        skipReason: 'Markov organic rest day (2/3)',
      };
    }
    return { shouldCommit: true };
  }

  // Fallback for default active evaluation
  return { shouldCommit: true };
}

/**
 * Generates guaranteed active commit count (>= 1 commit) on active days.
 * Eliminates 0-commit dead runs to prevent wasted CI/CD action minutes.
 */
export function getSeededRandomCommitCount(dateStr: string, intensity: IntensityLevel): number {
  const { roll, count } = seededHash(dateStr);

  if (intensity === 1) {
    // Level 1: 1-10 commits range
    if (roll < 60) {
      return 1 + (count % 3); // 1-3 commits (~60%)
    } else if (roll < 85) {
      return 4 + (count % 3); // 4-6 commits (~25%)
    } else {
      return 7 + (count % 4); // 7-10 commits (~15%)
    }
  }

  if (intensity === 2) {
    // Level 2: 1-3 commits minimal spectrum
    if (roll < 50) {
      return 1; // 1 commit (~50%)
    } else if (roll < 80) {
      return 2; // 2 commits (~30%)
    } else {
      return 3; // 3 commits (~20%)
    }
  }

  if (intensity === 3) {
    // Level 3: 1-55 commits moderate spectrum
    if (roll < 50) {
      return 1 + (count % 12); // 1 - 12 commits (~50%)
    } else if (roll < 80) {
      return 13 + (count % 16); // 13 - 28 commits (~30%)
    } else if (roll < 92) {
      return 29 + (count % 14); // 29 - 42 commits (~12%)
    } else {
      return 43 + (count % 13); // 43 - 55 commits (~8%)
    }
  }

  if (intensity === 4) {
    // Level 4: 1-80 commits peak spectrum
    if (roll < 45) {
      return 1 + (count % 15); // 1 - 15 commits (~45%)
    } else if (roll < 75) {
      return 16 + (count % 30); // 16 - 45 commits (~30%)
    } else if (roll < 90) {
      return 46 + (count % 25); // 46 - 70 commits (~15%)
    } else {
      return 71 + (count % 10); // 71 - 80 commits (~10%)
    }
  }

  return 1;
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
