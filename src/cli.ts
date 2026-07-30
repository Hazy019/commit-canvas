#!/usr/bin/env node

import { Command } from 'commander';
import { IntensityLevel, PatternName } from './config/types';
import { CommitRunner } from './engine/commitRunner';
import { Verifier } from './engine/verifier';
import { PatternEngine } from './logic/patternEngine';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('commit-canvas')
  .description('Automated git contribution pattern engine with day-of-week procedural filtering')
  .version('1.0.0');

/**
 * PREVIEW COMMAND
 * Visualizes the pattern grid and planned commits without modifying git history.
 */
program
  .command('preview')
  .description('Preview the 7x52 contribution activity grid and planned commits')
  .option('-w, --weeks <number>', 'Number of weeks in timeline grid', '52')
  .option('-i, --intensity <level>', 'Intensity level (1: 2-8, 2: 5-35 organic, 3: 12-45, 4: 20-60 commits)', '2')
  .option('-p, --pattern <name>', 'Pattern rule name', 'all-but-sat')
  .option('-e, --end-date <date>', 'Target end date override (YYYY-MM-DD)')
  .action((options) => {
    try {
      const weeks = parseInt(options.weeks, 10);
      const intensity = parseInt(options.intensity, 10) as IntensityLevel;
      const pattern = options.pattern as PatternName;

      const engine = new PatternEngine({
        weeks,
        intensity,
        pattern,
        endDateStr: options.endDate,
      });

      const summary = engine.generatePlan();
      Logger.renderGrid(summary);
    } catch (err: any) {
      Logger.error(`Preview failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * SYNC COMMAND
 * Executes the contribution pattern on the current git repository history.
 */
program
  .command('sync')
  .description('Execute deterministic git commits for the target contribution grid pattern')
  .option('-w, --weeks <number>', 'Number of weeks in timeline grid', '52')
  .option('-i, --intensity <level>', 'Intensity level (1, 2, 3, 4)', '2')
  .option('-p, --pattern <name>', 'Pattern rule name', 'all-but-sat')
  .option('-d, --dry-run', 'Simulate execution without modifying git history', false)
  .option('-e, --end-date <date>', 'Target end date override (YYYY-MM-DD)')
  .option('-m, --email <email>', 'Target author email for contribution attribution')
  .option('-f, --force', 'Bypass idempotency check and force re-committing pattern', false)
  .action((options) => {
    try {
      const weeks = parseInt(options.weeks, 10);
      const intensity = parseInt(options.intensity, 10) as IntensityLevel;
      const pattern = options.pattern as PatternName;
      const dryRun = Boolean(options.dryRun);
      const email = options.email;
      const force = Boolean(options.force);

      const engine = new PatternEngine({
        weeks,
        intensity,
        pattern,
        endDateStr: options.endDate,
      });

      const summary = engine.generatePlan();
      const runner = new CommitRunner({ dryRun, email, force });
      runner.run(summary);
    } catch (err: any) {
      Logger.error(`Sync failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * VERIFY COMMAND
 * Checks git commit history to ensure no Saturday commits exist and signatures are valid.
 */
program
  .command('verify')
  .description('Check git history to ensure compliance with pattern rules (e.g. no Saturday commits)')
  .option('-p, --pattern <name>', 'Pattern rule name to verify', 'all-but-sat')
  .option('-m, --max-commits <number>', 'Maximum commits to scan', '5000')
  .action((options) => {
    try {
      const pattern = options.pattern as PatternName;
      const maxCommits = parseInt(options.maxCommits, 10);

      const result = Verifier.verify({
        pattern,
        maxCommits,
      });

      if (!result.success) {
        process.exit(1);
      }
    } catch (err: any) {
      Logger.error(`Verification failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * HEAL COMMAND
 * Automatically drops violating Saturday commits from git history.
 */
program
  .command('heal')
  .description('Automated self-healing: drops any violating Saturday commits via rebase')
  .option('-b, --branch <name>', 'Branch to heal', 'main')
  .option('-m, --max-commits <number>', 'Maximum commits to scan', '5000')
  .action(async (options) => {
    try {
      const maxCommits = parseInt(options.maxCommits, 10);
      const { Healer } = await import('./engine/healer');
      Healer.heal(options.branch, maxCommits);
    } catch (err: any) {
      Logger.error(`Healing failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
