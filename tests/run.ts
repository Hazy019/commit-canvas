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
    friDecision.plannedCommits >= 5 && friDecision.plannedCommits <= 35,
    `Level 2 intensity should generate between 5 and 35 commits (got ${friDecision.plannedCommits})`
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
    plan.totalCommitsPlanned >= plan.activeDays * 5 && plan.totalCommitsPlanned <= plan.activeDays * 35,
    `Total commits planned should be within 5-35 range per active day (got ${plan.totalCommitsPlanned})`
  );
});

// 4. Verifier Compliance Test on Empty/Valid History
test('Verifier correctly passes on non-Saturday commit check', () => {
  const result = Verifier.verify({ pattern: 'all-but-sat', maxCommits: 50 });
  assert.strictEqual(result.saturdayCommitsFound, 0, 'Current clean branch should have 0 Saturday commits');
  assert.strictEqual(result.success, true, 'Verification result should be success: true');
});

console.log(`\nResults: ${passed}/${total} unit tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
