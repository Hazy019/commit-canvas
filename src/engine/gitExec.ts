import { execSync } from 'child_process';

export interface GitCommitOptions {
  message: string;
  timestampIso: string;
  cwd?: string;
  email?: string;
}

export class GitExec {
  /**
   * Executes a git command in child process.
   */
  public static run(cmd: string, env: Record<string, string> = {}, cwd: string = process.cwd()): string {
    const combinedEnv = { ...process.env, ...env };
    try {
      return execSync(cmd, { cwd, env: combinedEnv, encoding: 'utf-8', stdio: 'pipe' }).trim();
    } catch (err: any) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      throw new Error(`Git command failed: '${cmd}'. Stderr: ${stderr}`);
    }
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
   * Creates empty commits cleanly and rapidly in pure Node to avoid shell script cross-platform bugs.
   */
  public static createEmptyCommitsBatch(commits: GitCommitOptions[], authorEmail?: string, cwd: string = process.cwd()): void {
    if (commits.length === 0) return;

    // Temporarily disable auto-GC during batch creation to avoid background process locks
    try {
      GitExec.run('git config --local gc.auto 0', {}, cwd);
    } catch {
      // Ignore if repo is not configured yet
    }

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

    // Re-enable default auto-GC after batch completion
    try {
      GitExec.run('git config --local --unset gc.auto', {}, cwd);
    } catch {
      // Ignore
    }
  }

  /**
   * Fetches recent git commit messages from current branch history to check for idempotency.
   * If targetEmail is provided, only commits authored by targetEmail are counted as existing.
   */
  public static getExistingSignatures(targetEmail?: string, maxCommits = 5000, cwd: string = process.cwd()): Set<string> {
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
  public static getCommitLog(maxCommits = 5000, cwd: string = process.cwd()): Array<{ hash: string; isoDate: string; message: string }> {
    try {
      const format = '%H|%ad|%s';
      const output = GitExec.run(`git log -n ${maxCommits} --date=iso-strict --format="${format}"`, {}, cwd);
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
