import assert from 'assert';
import { PATTERN_RULES } from '../src/config/patternConfig';
import { DateIterator } from '../src/logic/dateIterator';
import { DayOfWeekFilter } from '../src/logic/dayOfWeekFilter';
import { PatternEngine } from '../src/logic/patternEngine';
import { parseDateUTC, getUTCDayOfWeek, formatDateUTC } from '../src/utils/timezone';
import { Verifier } from '../src/engine/verifier';

console.log('\n========================================');
console.log(' RUNNING COMMIT-CANVAS UNIT TEST SUITE');
console.log('========================================\n');

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

// 1. Day-of-Week Filter Tests
test('DayOfWeekFilter strictly filters Saturday (day 6)', () => {
  const rule = PATTERN_RULES['all-but-sat'];
  const filter = new DayOfWeekFilter(rule, 2);

  // Test Saturday (2026-08-01 is a Saturday)
  const satDate = parseDateUTC('2026-08-01');
  assert.strictEqual(getUTCDayOfWeek(satDate), 6, '2026-08-01 should be Saturday (6)');
  const satDecision = filter.evaluateDate(satDate);
  assert.strictEqual(satDecision.shouldCommit, false, 'Saturday should have shouldCommit: false');
  assert.strictEqual(satDecision.plannedCommits, 0, 'Saturday plannedCommits should be 0');

  // Test Friday (2026-07-31 is a Friday)
  const friDate = parseDateUTC('2026-07-31');
  assert.strictEqual(getUTCDayOfWeek(friDate), 5, '2026-07-31 should be Friday (5)');
  const friDecision = filter.evaluateDate(friDate);
  assert.strictEqual(friDecision.shouldCommit, true, 'Friday should have shouldCommit: true');
  assert.ok(
    friDecision.plannedCommits >= 5 && friDecision.plannedCommits <= 60,
    `Level 2 intensity should generate between 5 and 60 commits (got ${friDecision.plannedCommits})`
  );

  // Test Sunday (2026-07-26 is a Sunday)
  const sunDate = parseDateUTC('2026-07-26');
  assert.strictEqual(getUTCDayOfWeek(sunDate), 0, '2026-07-26 should be Sunday (0)');
  const sunDecision = filter.evaluateDate(sunDate);
  assert.strictEqual(sunDecision.shouldCommit, true, 'Sunday should have shouldCommit: true');
});

// 2. Date Iterator Alignment Tests
test('DateIterator aligns timeline grid over 52 weeks', () => {
  const iterator = new DateIterator({ weeks: 52, endDateStr: '2026-07-26' });
  const dates = iterator.getDatesArray();
  assert.ok(dates.length >= 364, `Expected at least 364 days, got ${dates.length}`);

  // Start date must be a Sunday (day 0)
  const firstDate = dates[0];
  assert.strictEqual(getUTCDayOfWeek(firstDate), 0, 'Grid start date must be a Sunday (0)');
});

// 3. Pattern Engine Generation Tests
test('PatternEngine produces correct active and skipped day breakdown for 52 weeks', () => {
  // Pass an endDateStr ending on Saturday to get exactly 52 full weeks (364 days)
  const engine = new PatternEngine({ weeks: 52, endDateStr: '2026-07-25', pattern: 'all-but-sat', intensity: 2 });
  const plan = engine.generatePlan();

  assert.strictEqual(plan.patternName, 'all-but-sat');
  assert.strictEqual(plan.skippedDays, 52, '52 weeks should yield exactly 52 skipped Saturdays');
  assert.strictEqual(plan.activeDays, 312, '52 weeks should yield exactly 312 active days (52 * 6)');
  assert.strictEqual(plan.activeDays, plan.skippedDays * 6, 'Sun-Fri active days should be 6x skipped Saturdays');
  assert.ok(
    plan.totalCommitsPlanned >= plan.activeDays * 5 && plan.totalCommitsPlanned <= plan.activeDays * 60,
    `Total commits planned should be within 5-60 range per active day (got ${plan.totalCommitsPlanned})`
  );
});

// 4. Intensity Level 3 Organic Spectrum Test (0 to 55 commits with rest days)
test('PatternEngine handles Level 3 intensity (0 to 55 commits range with rest days)', () => {
  const engine = new PatternEngine({ weeks: 52, endDateStr: '2026-07-25', pattern: 'all-but-sat', intensity: 3 });
  const plan = engine.generatePlan();

  assert.strictEqual(plan.patternName, 'all-but-sat');
  assert.ok(plan.totalCommitsPlanned > 0, 'Level 3 should generate commits across the year');
  assert.ok(plan.skippedDays >= 52, 'Level 3 should skip at least 52 Saturdays plus rest days');
});

// 5. Intensity Level 4 Organic Spectrum Test (0 to 80 commits with rest days)
test('PatternEngine handles Level 4 intensity (0 to 80 commits range with rest days)', () => {
  const engine = new PatternEngine({ weeks: 52, endDateStr: '2026-07-25', pattern: 'all-but-sat', intensity: 4 });
  const plan = engine.generatePlan();

  assert.strictEqual(plan.patternName, 'all-but-sat');
  assert.ok(plan.totalCommitsPlanned > 0, 'Level 4 should generate commits across the year');
  assert.ok(plan.skippedDays >= 52, 'Level 4 should skip at least 52 Saturdays plus rest days');
});

// 5. Peak Preservation Exclusion Algorithm Test
test('DayOfWeekFilter strictly excludes May 11, May 27, and May 28 to preserve organic peaks', () => {
  const engine = new PatternEngine({
    startDateStr: '2026-05-01',
    endDateStr: '2026-05-31',
    pattern: 'all-but-sat',
    intensity: 4,
    excludeDates: ['05-11', '05-27', '05-28'],
  });
  const plan = engine.generatePlan();

  const may11 = plan.decisions.find((d) => d.dateStr === '2026-05-11');
  const may27 = plan.decisions.find((d) => d.dateStr === '2026-05-27');
  const may28 = plan.decisions.find((d) => d.dateStr === '2026-05-28');

  assert.ok(may11, 'May 11 decision should exist');
  assert.strictEqual(may11?.shouldCommit, false, 'May 11 should be excluded');
  assert.strictEqual(may11?.plannedCommits, 0, 'May 11 should have 0 planned commits');

  assert.ok(may27, 'May 27 decision should exist');
  assert.strictEqual(may27?.shouldCommit, false, 'May 27 should be excluded');
  assert.strictEqual(may27?.plannedCommits, 0, 'May 27 should have 0 planned commits');

  assert.ok(may28, 'May 28 decision should exist');
  assert.strictEqual(may28?.shouldCommit, false, 'May 28 should be excluded');
  assert.strictEqual(may28?.plannedCommits, 0, 'May 28 should have 0 planned commits');
});

// 6. Start Date Override Test (January Start)
test('PatternEngine starting from January correctly aligns timeline', () => {
  const engine = new PatternEngine({
    startDateStr: '2026-01-01',
    endDateStr: '2026-08-01',
    pattern: 'all-but-sat',
    intensity: 4,
  });
  const plan = engine.generatePlan();
  assert.ok(plan.startDateStr.startsWith('2026-01-') || plan.startDateStr.startsWith('2025-12-'), 'Start date should align near January 1');
});

// 7. Verifier Compliance Test on Empty/Valid History
test('Verifier correctly passes on non-Saturday commit check', () => {
  const result = Verifier.verify({ pattern: 'all-but-sat', maxCommits: 50 });
  assert.strictEqual(result.saturdayCommitsFound, 0, 'Current clean branch should have 0 Saturday commits');
  assert.strictEqual(result.success, true, 'Verification result should be success: true');
});

console.log(`\nResults: ${passed}/${total} unit tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
