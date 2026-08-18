import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateMarkovDecision, getSeededRandomCommitCount, PATTERN_RULES } from '../src/config/patternConfig';
import { GitExec } from '../src/engine/gitExec';
import { Verifier } from '../src/engine/verifier';
import { DateIterator } from '../src/logic/dateIterator';
import { DayOfWeekFilter } from '../src/logic/dayOfWeekFilter';
import { PatternEngine } from '../src/logic/patternEngine';
import { createHumanCommitTimestampUTC, formatDateUTC, getUTCDayOfWeek, parseDateUTC } from '../src/utils/timezone';

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
  assert.ok(
    friDecision.plannedCommits >= 1 && friDecision.plannedCommits <= 3,
    `Level 2 intensity should generate between 1 and 3 commits (got ${friDecision.plannedCommits})`
  );

  // Test Sunday (2026-07-26 is a Sunday)
  const sunDate = parseDateUTC('2026-07-26');
  assert.strictEqual(getUTCDayOfWeek(sunDate), 0, '2026-07-26 should be Sunday (0)');
  const sunDecision = filter.evaluateDate(sunDate);
  assert.strictEqual(sunDecision.shouldCommit, true, 'Sunday should have shouldCommit: true');
  assert.ok(sunDecision.plannedCommits >= 1, 'Active Sunday should have >= 1 commits');
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

// 3. Pattern Engine Generation & Organic Rest Day Tests
test('PatternEngine correctly handles active days and organic rest days (0 commits)', () => {
  const engine = new PatternEngine({ weeks: 52, endDateStr: '2026-07-25', pattern: 'all-but-sat', intensity: 2, excludeDates: [] });
  const plan = engine.generatePlan();

  assert.strictEqual(plan.patternName, 'all-but-sat');
  assert.ok(plan.skippedDays >= 52, '52 weeks should yield at least 52 skipped Saturdays plus organic rest days');
  assert.ok(plan.activeDays > 0, 'Plan should contain active commit days');

  for (const decision of plan.decisions) {
    if (decision.shouldCommit) {
      assert.ok(decision.plannedCommits >= 1, `Active day ${decision.dateStr} must have >= 1 commit`);
      assert.strictEqual(decision.commits.length, decision.plannedCommits);
    } else {
      assert.strictEqual(decision.plannedCommits, 0, `Skipped/Rest day ${decision.dateStr} must have 0 planned commits`);
      assert.strictEqual(decision.commits.length, 0);
    }
  }
});

// 4. Markov State Transition & Maximum 3-Day Rest Bounds
test('Markov state engine strictly enforces maximum 3-day dry spell limit with forced commit', () => {
  // When daysSinceLastCommit >= 3, evaluateMarkovDecision must unconditionally return shouldCommit: true
  const decisionDay3 = evaluateMarkovDecision('2026-08-16', 3, 3);
  assert.strictEqual(decisionDay3.shouldCommit, true, 'Day 3 inactivity must force an active commit day');

  const decisionDay5 = evaluateMarkovDecision('2026-08-16', 5, 3);
  assert.strictEqual(decisionDay5.shouldCommit, true, 'Day 5 inactivity must force an active commit day');

  // getSeededRandomCommitCount must generate >= 1 commit
  const activeCount = getSeededRandomCommitCount('2026-08-16', 2);
  assert.ok(activeCount >= 1, 'Active day must generate >= 1 commit');
});

// 5. Intensity Levels 1-4 Calibrated Active Ranges & Hard Cap <= 50 Test
test('Intensity Levels 1-4 generate correct active ranges [1, max] (L1: 1-10, L2: 1-3, L3: 1-30, L4: 1-50) and strictly NEVER exceed 50 commits', () => {
  // Test across an entire year of dates (365 days) to ensure absolute statistical compliance
  const baseDate = new Date('2026-01-01T00:00:00Z');

  for (let d = 0; d < 365; d++) {
    const curr = new Date(baseDate.getTime() + d * 86400000);
    const dateStr = formatDateUTC(curr);

    const c1 = getSeededRandomCommitCount(dateStr, 1);
    assert.ok(c1 >= 1 && c1 <= 10, `Level 1 must be in [1, 10] (got ${c1} on ${dateStr})`);

    const c2 = getSeededRandomCommitCount(dateStr, 2);
    assert.ok(c2 >= 1 && c2 <= 3, `Level 2 must be in [1, 3] (got ${c2} on ${dateStr})`);

    const c3 = getSeededRandomCommitCount(dateStr, 3);
    assert.ok(c3 >= 1 && c3 <= 30, `Level 3 must be in [1, 30] (got ${c3} on ${dateStr})`);

    const c4 = getSeededRandomCommitCount(dateStr, 4);
    assert.ok(c4 >= 1 && c4 <= 50, `Level 4 must be in [1, 50] and NEVER > 50 (got ${c4} on ${dateStr})`);
  }
});

// 6. Circadian Human Working-Hour Timestamps Test
test('createHumanCommitTimestampUTC generates realistic working hours (09:00 - 22:30 UTC)', () => {
  const dateStr = '2026-08-16';
  const totalCommits = 5;

  for (let i = 1; i <= totalCommits; i++) {
    const timestamp = createHumanCommitTimestampUTC(dateStr, i, totalCommits);
    const dateObj = new Date(timestamp);
    const hour = dateObj.getUTCHours();

    assert.ok(hour >= 9 && hour <= 23, `Timestamp hour ${hour} must be within active hours 9-23`);
    assert.strictEqual(formatDateUTC(dateObj), dateStr, 'Timestamp date must match input date string');
  }
});

// 7. Peak Preservation Exclusion Algorithm Test
test('DayOfWeekFilter strictly excludes configured peak preservation dates (03-23, 03-27, 04-27, 05-11, 05-27, 05-28, 06-10, 06-14)', () => {
  const excludeDates = ['03-23', '03-27', '04-27', '05-11', '05-27', '05-28', '06-10', '06-14'];
  const engine = new PatternEngine({
    startDateStr: '2026-03-01',
    endDateStr: '2026-06-30',
    pattern: 'all-but-sat',
    intensity: 4,
    excludeDates,
  });
  const plan = engine.generatePlan();

  for (const ex of excludeDates) {
    const fullDateStr = `2026-${ex}`;
    const decision = plan.decisions.find((d) => d.dateStr === fullDateStr);
    assert.ok(decision, `${fullDateStr} decision should exist`);
    assert.strictEqual(decision?.shouldCommit, false, `${fullDateStr} should be excluded`);
    assert.strictEqual(decision?.plannedCommits, 0, `${fullDateStr} should have 0 planned commits`);
  }
});

// 8. Git Lockfile Detection & Self-Recovery Test
test('GitExec.cleanupStaleLocks detects and removes artificial stale locks', () => {
  const gitDir = path.join(process.cwd(), '.git');
  if (fs.existsSync(gitDir)) {
    const dummyLock = path.join(gitDir, 'shallow.lock');
    fs.writeFileSync(dummyLock, 'stale lock dummy content');
    assert.ok(fs.existsSync(dummyLock), 'Dummy lock file should exist before cleanup');

    GitExec.cleanupStaleLocks(process.cwd());
    assert.strictEqual(fs.existsSync(dummyLock), false, 'Dummy lock file should be safely removed');
  }
});

// 9. Verifier Compliance Test
test('Verifier correctly passes on non-Saturday commit check', () => {
  const result = Verifier.verify({ pattern: 'all-but-sat', maxCommits: 50 });
  assert.strictEqual(result.saturdayCommitsFound, 0, 'Current clean branch should have 0 Saturday commits');
  assert.strictEqual(result.success, true, 'Verification result should be success: true');
});

console.log(`\nResults: ${passed}/${total} unit tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
