import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { formatDateUTC, parseDateUTC } from '../utils/timezone';

export interface GitCommitOptions {
  message: string;
  timestampIso: string;
  cwd?: string;
  email?: string;
}

export class GitExec {
  /**
   * Cleans up stale git lock files (.git/index.lock, etc.) if previous processes crashed or left locks.
   */
  public static cleanupStaleLocks(cwd: string = process.cwd()): void {
    try {
      const gitDir = path.join(cwd, '.git');
      if (fs.existsSync(gitDir)) {
        const lockFiles = ['index.lock', 'shallow.lock', 'HEAD.lock', 'config.lock'];
        for (const lockFile of lockFiles) {
          const lockPath = path.join(gitDir, lockFile);
          if (fs.existsSync(lockPath)) {
            try {
              fs.unlinkSync(lockPath);
            } catch {
              // Ignore if locked by another thread
            }
          }
        }
      }
    } catch {
      // Ignore filesystem inspection errors
    }
  }

  /**
   * Executes a git command in child process with automated lock detection, retry, and error recovery.
   */
  public static run(
    cmd: string,
    env: Record<string, string> = {},
    cwd: string = process.cwd(),
    retries: number = 2
  ): string {
    const combinedEnv = { ...process.env, ...env };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return execSync(cmd, {
          cwd,
          env: combinedEnv,
          encoding: 'utf-8',
          stdio: 'pipe',
        }).trim();
      } catch (err: any) {
        const stderr = err.stderr ? err.stderr.toString() : err.message;
        const isLockError =
          stderr.includes('index.lock') ||
          stderr.includes('shallow.lock') ||
          stderr.includes('HEAD.lock') ||
          stderr.includes('Another git process seems to be running');

        if (isLockError && attempt <= retries) {
          GitExec.cleanupStaleLocks(cwd);
          // Exponential backoff
          const waitMs = attempt * 150;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
          continue;
        }

        if (attempt > retries) {
          throw new Error(`Git command failed: '${cmd}'. Stderr: ${stderr}`);
        }
      }
    }

    return '';
  }

  /**
   * Creates an empty commit with explicit GIT_AUTHOR_DATE, GIT_COMMITTER_DATE, and email overrides.
   */
  public static createEmptyCommit(options: GitCommitOptions): string {
    const { message, timestampIso, cwd, email } = options;
    const env: Record<string, string> = {
      GIT_AUTHOR_DATE: timestampIso,
      GIT_COMMITTER_DATE: timestampIso,
    };
    if (email) {
      env.GIT_AUTHOR_EMAIL = email;
      env.GIT_COMMITTER_EMAIL = email;
    }
    const safeMessage = message.replace(/"/g, '\\"');
    const cmd = `git commit --allow-empty -m "${safeMessage}"`;
    return GitExec.run(cmd, env, cwd);
  }

  /**
   * Creates empty commits cleanly and rapidly in pure Node with fault-tolerant GC management and lock recovery.
   */
  public static createEmptyCommitsBatch(
    commits: GitCommitOptions[],
    authorEmail?: string,
    cwd: string = process.cwd()
  ): void {
    if (commits.length === 0) return;

    // Temporarily disable auto-GC during batch creation to avoid background process locks
    try {
      GitExec.run('git config --local gc.auto 0', {}, cwd);
    } catch {
      // Ignore if repo is not configured yet
    }

    try {
      for (const commit of commits) {
        const { message, timestampIso, email } = commit;
        const env: Record<string, string> = {
          GIT_AUTHOR_DATE: timestampIso,
          GIT_COMMITTER_DATE: timestampIso,
        };
        const targetEmail = authorEmail || email;
        if (targetEmail) {
          env.GIT_AUTHOR_EMAIL = targetEmail;
          env.GIT_COMMITTER_EMAIL = targetEmail;
        }
        const safeMessage = message.replace(/"/g, '\\"');
        // Use --quiet to keep stdio buffer light and fast
        const cmd = `git commit --quiet --allow-empty -m "${safeMessage}"`;
        GitExec.run(cmd, env, cwd);
      }
    } finally {
      // Re-enable default auto-GC and repack objects into a clean packfile
      try {
        GitExec.run('git config --local --unset gc.auto', {}, cwd);
        GitExec.run('git repack -a -d', {}, cwd);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Inspects the latest commit author date from git history to calculate days since last commit.
   * Enables state persistence across ephemeral CI runners with zero external database dependencies.
   */
  public static getLastCommitDate(targetEmail?: string, cwd: string = process.cwd()): Date | null {
    try {
      const format = '%ae|%ad';
      const output = GitExec.run(`git log -n 50 --date=iso-strict --format="${format}"`, {}, cwd);
      if (!output) return null;

      const lines = output.split('\n');
      for (const line of lines) {
        const [email, isoDate] = line.split('|');
        if (!isoDate) continue;

        if (targetEmail && email) {
          if (email.trim().toLowerCase() !== targetEmail.trim().toLowerCase()) {
            continue;
          }
        }

        const dateObj = new Date(isoDate.trim());
        if (!isNaN(dateObj.getTime())) {
          return dateObj;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Computes the number of days elapsed between today and the latest commit in history.
   * Returns 3 (forced active) if repository has no prior commit history.
   */
  public static getDaysSinceLastCommit(
    targetEmail?: string,
    targetDate: Date = new Date(),
    cwd: string = process.cwd()
  ): number {
    const lastDate = GitExec.getLastCommitDate(targetEmail, cwd);
    if (!lastDate) {
      return 3; // No history, trigger immediate active sprint
    }

    const todayStr = formatDateUTC(targetDate);
    const lastStr = formatDateUTC(lastDate);

    const todayNormalized = parseDateUTC(todayStr);
    const lastNormalized = parseDateUTC(lastStr);

    const diffMs = todayNormalized.getTime() - lastNormalized.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Fetches recent git commit messages from current branch history to check for idempotency.
   * If targetEmail is provided, only commits authored by targetEmail are counted as existing.
   */
  public static getExistingSignatures(
    targetEmail?: string,
    maxCommits = 5000,
    cwd: string = process.cwd()
  ): Set<string> {
    try {
      const format = '%ae|%s';
      const output = GitExec.run(`git log -n ${maxCommits} --format="${format}"`, {}, cwd);
      const signatures = new Set<string>();
      if (!output) return signatures;

      const lines = output.split('\n');
      for (const line of lines) {
        const [authorEmail, subject] = line.split('|');
        if (!subject) continue;

        // If targetEmail is specified, skip signatures authored by a different email (e.g. old bot runs)
        if (targetEmail && authorEmail) {
          if (authorEmail.trim().toLowerCase() !== targetEmail.trim().toLowerCase()) {
            continue;
          }
        }

        const match = subject.match(/\[commit-canvas-filter:[^\]]+\]/);
        if (match) {
          signatures.add(match[0]);
        }
      }
      return signatures;
    } catch (err) {
      // If repository has no commits yet, return empty set
      return new Set<string>();
    }
  }

  /**
   * Retrieves all commits from git history with hash, author date ISO, and message.
   */
  public static getCommitLog(
    maxCommits = 5000,
    cwd: string = process.cwd()
  ): Array<{ hash: string; isoDate: string; message: string }> {
    try {
      const format = '%H|%ad|%s';
      const output = GitExec.run(
        `git log -n ${maxCommits} --date=iso-strict --format="${format}"`,
        {},
        cwd
      );
      if (!output) return [];

      const lines = output.split('\n');
      return lines.map((line) => {
        const [hash, isoDate, message] = line.split('|');
        return { hash, isoDate, message: message || '' };
      });
    } catch (err) {
      return [];
    }
  }
}
