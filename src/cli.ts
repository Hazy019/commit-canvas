#!/usr/bin/env node

import { Command } from 'commander';
import { IntensityLevel, PatternName } from './config/types';
import { CommitRunner } from './engine/commitRunner';
import { GitExec } from './engine/gitExec';
import { Verifier } from './engine/verifier';
import { PatternEngine } from './logic/patternEngine';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('commit-canvas')
  .description('Automated git contribution pattern engine with day-of-week procedural filtering & Markov state mechanics')
  .version('1.0.0');

/**
 * PREVIEW COMMAND
 * Visualizes the pattern grid and planned commits without modifying git history.
 */
program
  .command('preview')
  .description('Preview the contribution activity grid and planned commits')
  .option('-w, --weeks <number>', 'Number of weeks in timeline grid', '52')
  .option('-i, --intensity <level>', 'Intensity level (1: 1-10 light, 2: 1-3 minimal, 3: 1-30 moderate, 4: 1-50 peak)', '3')
  .option('-p, --pattern <name>', 'Pattern rule name', 'all-but-sat')
  .option('-s, --start-date <date>', 'Target start date override (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'Target end date override (YYYY-MM-DD)')
  .option('-x, --exclude-dates <dates>', 'Comma-separated dates (MM-DD or YYYY-MM-DD) to exclude for peak preservation', '03-23,03-27,04-27,05-11,05-27,05-28,06-10,06-14')
  .option('--no-markov', 'Disable Markov state transition simulation')
  .action((options) => {
    try {
      const weeks = parseInt(options.weeks, 10);
      const intensity = parseInt(options.intensity, 10) as IntensityLevel;
      const pattern = options.pattern as PatternName;
      const excludeDates = options.excludeDates ? options.excludeDates.split(',').map((d: string) => d.trim()).filter(Boolean) : [];
      const useMarkov = options.markov !== false;

      const engine = new PatternEngine({
        weeks,
        intensity,
        pattern,
        startDateStr: options.startDate,
        endDateStr: options.endDate,
        excludeDates,
        useMarkov,
      });

      const summary = engine.generatePlan();
      Logger.renderGrid(summary);
    } catch (err: any) {
      Logger.error(`Preview failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * SYNC / EXECUTE COMMAND
 * Generates and commits contribution pattern to local and remote repository history.
 */
program
  .command('sync')
  .description('Generate procedural contribution pattern and apply commits to git history')
  .option('-w, --weeks <number>', 'Number of weeks in timeline grid', '1')
  .option('-i, --intensity <level>', 'Intensity level (1: 1-10 light, 2: 1-3 minimal, 3: 1-30 moderate, 4: 1-50 peak)', '3')
  .option('-p, --pattern <name>', 'Pattern rule name', 'all-but-sat')
  .option('-d, --dry-run', 'Simulate execution without modifying git history', false)
  .option('-s, --start-date <date>', 'Target start date override (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'Target end date override (YYYY-MM-DD)')
  .option('-x, --exclude-dates <dates>', 'Comma-separated dates (MM-DD or YYYY-MM-DD) to exclude for peak preservation', '03-23,03-27,04-27,05-11,05-27,05-28,06-10,06-14')
  .option('-m, --email <email>', 'Target author email for contribution attribution')
  .option('-f, --force', 'Bypass idempotency check and force re-committing pattern', false)
  .option('--no-markov', 'Disable Markov state transition modeling')
  .action((options) => {
    try {
      const weeks = parseInt(options.weeks, 10);
      const intensity = parseInt(options.intensity, 10) as IntensityLevel;
      const pattern = options.pattern as PatternName;
      const dryRun = Boolean(options.dryRun);
      const email = options.email;
      const force = Boolean(options.force);
      const excludeDates = options.excludeDates ? options.excludeDates.split(',').map((d: string) => d.trim()) : undefined;
      const useMarkov = options.markov !== false;

      // Extract initial inactivity delta directly from git history
      let initialDaysSinceLastCommit = 1;
      try {
        initialDaysSinceLastCommit = GitExec.getDaysSinceLastCommit(email);
      } catch {
        initialDaysSinceLastCommit = 1;
      }

      const engine = new PatternEngine({
        weeks,
        intensity,
        pattern,
        startDateStr: options.startDate,
        endDateStr: options.endDate,
        excludeDates,
        useMarkov,
        initialDaysSinceLastCommit,
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
 * PR-SYNC COMMAND
 * Automates Pull Request creation and merging for Pull Shark achievement and natural PR ratios.
 */
program
  .command('pr-sync')
  .description('Automate Pull Request creation and merge for Pull Shark achievement progression')
  .option('-c, --count <number>', 'Number of PRs to create and merge', '1')
  .option('--auto-merge <value>', 'Automatically merge PR (true/false)', 'false')
  .option('--email <email>', 'Target author email', 'Kyrell0602@gmail.com')
  .option('--name <name>', 'Target author name', 'Hazy019')
  .option('--category <category>', 'PR category (docs, chore, refactor, types, perf)')
  .action(async (options) => {
    try {
      const count = parseInt(options.count, 10);
      const autoMerge = String(options.autoMerge).toLowerCase() === 'true';
      const { PrAutomationEngine } = await import('./engine/prAutomation');
      const engine = new PrAutomationEngine({
        count,
        autoMerge,
        authorEmail: options.email,
        authorName: options.name,
        category: options.category,
      });

      const results = engine.run();
      const mergedCount = results.filter((r) => r.merged).length;
      Logger.success(`PR Sync complete: ${results.length} PRs created, ${mergedCount} merged successfully.`);
    } catch (err: any) {
      Logger.error(`PR Sync failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

