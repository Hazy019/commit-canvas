import { PatternPlanSummary } from '../logic/patternEngine';
import { Logger } from '../utils/logger';
import { GitExec } from './gitExec';

export interface CommitRunnerOptions {
  dryRun?: boolean;
  verbose?: boolean;
  email?: string;
  force?: boolean;
}

export interface CommitRunnerResult {
  executed: number;
  skipped: number;
  total: number;
  success: boolean;
}

export class CommitRunner {
  private options: CommitRunnerOptions;

  constructor(options: CommitRunnerOptions = {}) {
    this.options = options;
  }

  /**
   * Runs the procedural pattern plan with complete error isolation, retry, and recovery mechanics.
   */
  public run(summary: PatternPlanSummary): CommitRunnerResult {
    Logger.info(
      `Starting Commit Execution Engine (Pattern: '${summary.patternName}', Dry Run: ${Boolean(
        this.options.dryRun
      )})`
    );

    let existingSignatures = new Set<string>();
    try {
      if (!this.options.dryRun && !this.options.force) {
        existingSignatures = GitExec.getExistingSignatures(this.options.email);
      }
    } catch (err: any) {
      Logger.warn(`Could not read existing signatures (${err.message}). Proceeding safely.`);
      existingSignatures = new Set<string>();
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
          timestampIso: commit.timestampIso,
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
      try {
        GitExec.createEmptyCommitsBatch(commitsToCreate, this.options.email);
      } catch (batchErr: any) {
        Logger.error(`Batch commit failed: ${batchErr.message}. Attempting self-recovery...`);
        GitExec.cleanupStaleLocks();
        try {
          // Retry batch execution once after lock cleanup
          GitExec.createEmptyCommitsBatch(commitsToCreate, this.options.email);
          Logger.success('Batch commit recovered and executed successfully.');
        } catch (retryErr: any) {
          Logger.error(`Batch commit fatal failure after recovery attempt: ${retryErr.message}`);
          throw retryErr;
        }
      }
    }

    Logger.success(`Execution complete! Commits Created: ${executedCount}, Days Skipped: ${summary.skippedDays}`);
    return {
      executed: executedCount,
      skipped: summary.skippedDays,
      total: summary.totalCommitsPlanned,
      success: true,
    };
  }
}
