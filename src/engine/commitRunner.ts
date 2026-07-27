import { PatternPlanSummary } from '../logic/patternEngine';
import { Logger } from '../utils/logger';
import { GitExec } from './gitExec';

export interface CommitRunnerOptions {
  dryRun?: boolean;
  verbose?: boolean;
  email?: string;
  force?: boolean;
}

export class CommitRunner {
  private options: CommitRunnerOptions;

  constructor(options: CommitRunnerOptions = {}) {
    this.options = options;
  }

  /**
   * Runs the procedural pattern plan.
   */
  public run(summary: PatternPlanSummary): { executed: number; skipped: number; total: number } {
    Logger.info(`Starting Commit Execution Engine (Pattern: '${summary.patternName}', Dry Run: ${Boolean(this.options.dryRun)})`);

    let existingSignatures = new Set<string>();
    if (!this.options.dryRun && !this.options.force) {
      existingSignatures = GitExec.getExistingSignatures(this.options.email);
    }

    let executedCount = 0;
    let skippedCount = 0;
    const commitsToCreate: any[] = [];

    for (const decision of summary.decisions) {
      if (!decision.shouldCommit) {
        // EXECUTE SKIP PATH
        Logger.skip(decision.dateStr, decision.dayName, decision.skipReason || 'Filtered day');
        skippedCount++;
        continue;
      }

      // EXECUTE GENERATE COMMITS PATH
      let dayCommitsCreated = 0;
      for (const commit of decision.commits) {
        if (existingSignatures.has(commit.signature)) {
          if (this.options.verbose) {
            Logger.info(`Idempotent skip: Signature '${commit.signature}' already exists in git log.`);
          }
          continue;
        }
        commitsToCreate.push({
          message: commit.signature,
          timestampIso: commit.timestampIso
        });
        existingSignatures.add(commit.signature);
        dayCommitsCreated++;
        executedCount++;
      }

      if (dayCommitsCreated > 0) {
        Logger.commit(decision.dateStr, decision.dayName, dayCommitsCreated);
      }
    }

    if (!this.options.dryRun && commitsToCreate.length > 0) {
      Logger.info(`Executing batched git commits (${commitsToCreate.length} commits)...`);
      GitExec.createEmptyCommitsBatch(commitsToCreate);
    }

    Logger.success(`Execution complete! Commits Created: ${executedCount}, Days Skipped: ${summary.skippedDays}`);
    return {
      executed: executedCount,
      skipped: summary.skippedDays,
      total: summary.totalCommitsPlanned,
    };
  }
}
