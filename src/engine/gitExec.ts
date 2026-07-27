import { execSync } from 'child_process';

export interface GitCommitOptions {
  message: string;
  timestampIso: string;
  cwd?: string;
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
   * Creates an empty commit with explicit GIT_AUTHOR_DATE and GIT_COMMITTER_DATE overrides.
   */
  public static createEmptyCommit(options: GitCommitOptions): string {
    const { message, timestampIso, cwd } = options;
    const env = {
      GIT_AUTHOR_DATE: timestampIso,
      GIT_COMMITTER_DATE: timestampIso,
    };
    // Escape quote characters in message for shell safety
    const safeMessage = message.replace(/"/g, '\\"');
    const cmd = `git commit --allow-empty -m "${safeMessage}"`;
    return GitExec.run(cmd, env, cwd);
  }

  /**
   * Fetches recent git commit messages from current branch history to check for idempotency.
   */
  public static getExistingSignatures(maxCommits = 5000, cwd: string = process.cwd()): Set<string> {
    try {
      const output = GitExec.run(`git log -n ${maxCommits} --format="%s"`, {}, cwd);
      const signatures = new Set<string>();
      if (!output) return signatures;

      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/\[commit-canvas-filter:[^\]]+\]/);
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
