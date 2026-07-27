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
    const safeMessage = message.replace(/"/g, '\\"');
    const cmd = `git commit --allow-empty -m "${safeMessage}"`;
    return GitExec.run(cmd, env, cwd);
  }

  /**
   * Creates empty commits in a single batched shell script to avoid process overhead and git lock issues.
   */
  public static createEmptyCommitsBatch(commits: GitCommitOptions[], cwd: string = process.cwd()): void {
    if (commits.length === 0) return;
    
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    
    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `commit-canvas-batch-${Date.now()}.sh`);
    
    // Disable GC auto to prevent background GC from interfering with rapid commits
    let scriptContent = `#!/bin/sh\ngit config --local gc.auto 0\n`;
    
    for (const commit of commits) {
      const safeMessage = commit.message.replace(/"/g, '\\"');
      scriptContent += `GIT_AUTHOR_DATE="${commit.timestampIso}" GIT_COMMITTER_DATE="${commit.timestampIso}" git commit --allow-empty -m "${safeMessage}"\n`;
    }
    
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    
    try {
      GitExec.run(`sh "${scriptPath}"`, {}, cwd);
    } finally {
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }
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
