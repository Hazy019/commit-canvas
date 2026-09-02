import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { getUTCDayOfWeek } from '../utils/timezone';
import { GitExec } from './gitExec';

export class Healer {
  /**
   * Cleans any residual rebase or merge state and stale lock files.
   */
  public static cleanupRebaseState(cwd: string = process.cwd()): void {
    try {
      GitExec.run('git rebase --abort', {}, cwd);
    } catch {
      // Ignore
    }
    try {
      const gitDir = path.join(cwd, '.git');
      const rebaseMerge = path.join(gitDir, 'rebase-merge');
      const rebaseApply = path.join(gitDir, 'rebase-apply');
      if (fs.existsSync(rebaseMerge)) fs.rmSync(rebaseMerge, { recursive: true, force: true });
      if (fs.existsSync(rebaseApply)) fs.rmSync(rebaseApply, { recursive: true, force: true });
      GitExec.run('git reset --hard HEAD', {}, cwd);
    } catch {
      // Ignore
    }
    GitExec.cleanupStaleLocks(cwd);
  }

  /**
   * Identifies violating Saturday commits and heals the repository history atomically using Git plumbing (git commit-tree).
   * - Dropping empty canvas commits
   * - Shifting non-canvas / PR commits by +1 day (to Sunday 00:00:01 UTC)
   * - Preserves all trees, merge relationships, and files with zero rebase conflicts.
   */
  public static heal(branch: string = 'main', maxCommits: number = 5000, cwd: string = process.cwd()): boolean {
    Logger.info('Starting automated Git history self-healing process...');
    Healer.cleanupRebaseState(cwd);

    const commits = GitExec.getCommitLog(maxCommits, cwd);
    const violatingHashes = new Set<string>();

    for (const commit of commits) {
      const dateObj = new Date(commit.isoDate);
      if (isNaN(dateObj.getTime())) continue;

      if (getUTCDayOfWeek(dateObj) === 6) {
        // Saturday
        violatingHashes.add(commit.hash);
      }
    }

    if (violatingHashes.size === 0) {
      Logger.success('No violating Saturday commits found. Repository history is healthy.');
      return true;
    }

    Logger.warn(
      `Found ${violatingHashes.size} violating Saturday commit(s). Initiating atomic plumbing history reconstruction...`
    );

    try {
      // Find oldest violating commit to determine topological range
      const oldestViolating = [...commits].reverse().find((c) => violatingHashes.has(c.hash));
      if (!oldestViolating) return true;

      let baseCommit = `${oldestViolating.hash}~1`;
      let revRange = `${baseCommit}..HEAD`;
      try {
        GitExec.run(`git rev-parse --verify "${baseCommit}"`, {}, cwd);
      } catch {
        revRange = 'HEAD';
      }

      const revListOutput = GitExec.run(`git rev-list --topo-order --reverse ${revRange}`, {}, cwd);
      const revList = revListOutput.split('\n').map((s) => s.trim()).filter(Boolean);

      Logger.info(`Reconstructing ${revList.length} commits starting from base boundary...`);

      const commitMap = new Map<string, string>();
      let droppedCount = 0;
      let shiftedCount = 0;

      for (const oldHash of revList) {
        const raw = GitExec.run(`git cat-file -p ${oldHash}`, {}, cwd);
        const lines = raw.split('\n');

        let tree = '';
        const parents: string[] = [];
        let authorLine = '';
        let committerLine = '';
        let headerEnded = false;
        const msgLines: string[] = [];

        for (const line of lines) {
          if (!headerEnded) {
            if (line === '') {
              headerEnded = true;
              continue;
            }
            if (line.startsWith('tree ')) tree = line.substring(5).trim();
            else if (line.startsWith('parent ')) parents.push(line.substring(7).trim());
            else if (line.startsWith('author ')) authorLine = line.substring(7);
            else if (line.startsWith('committer ')) committerLine = line.substring(10);
          } else {
            msgLines.push(line);
          }
        }

        const message = msgLines.join('\n').trim();
        const authorMatch = authorLine.match(/^(.*)\s+<([^>]+)>\s+(\d+)\s+([+-]\d{4})$/);
        let authorName = 'Hazy019';
        let authorEmail = 'Kyrell0602@gmail.com';
        let authorSeconds = 0;
        let authorTz = '+0000';

        if (authorMatch) {
          authorName = authorMatch[1];
          authorEmail = authorMatch[2];
          authorSeconds = parseInt(authorMatch[3], 10);
          authorTz = authorMatch[4];
        }

        const authorDate = new Date(authorSeconds * 1000);
        const dayOfWeek = getUTCDayOfWeek(authorDate);
        const isCanvasCommit = message.includes('[commit-canvas-filter:');

        const mappedParents = parents
          .map((p) => commitMap.get(p) || p)
          .filter((p) => p !== 'DROPPED');

        if (dayOfWeek === 6) {
          if (isCanvasCommit) {
            Logger.info(`Dropping violating canvas commit: ${oldHash.substring(0, 8)}`);
            commitMap.set(oldHash, mappedParents[0] || 'DROPPED');
            droppedCount++;
            continue;
          } else {
            // Shift to Sunday (+1 day / 86400 seconds)
            authorSeconds += 86400;
            Logger.info(`Shifting non-canvas commit date to Sunday: ${oldHash.substring(0, 8)}`);
            shiftedCount++;
          }
        }

        const parentsChanged = parents.some((p, idx) => mappedParents[idx] !== p);
        if (!parentsChanged && dayOfWeek !== 6) {
          commitMap.set(oldHash, oldHash);
          continue;
        }

        const parentArgs = mappedParents.map((p) => `-p ${p}`).join(' ');
        const authorDateStr = `${authorSeconds} ${authorTz}`;

        const env: Record<string, string> = {
          GIT_AUTHOR_NAME: authorName,
          GIT_AUTHOR_EMAIL: authorEmail,
          GIT_AUTHOR_DATE: authorDateStr,
          GIT_COMMITTER_NAME: authorName,
          GIT_COMMITTER_EMAIL: authorEmail,
          GIT_COMMITTER_DATE: authorDateStr,
        };

        const safeMsg = message.replace(/"/g, '\\"');
        const cmd = `git commit-tree ${tree} ${parentArgs} -m "${safeMsg}"`;
        const newHash = GitExec.run(cmd, env, cwd);
        commitMap.set(oldHash, newHash);
      }

      const finalHead = commitMap.get(revList[revList.length - 1]);
      if (finalHead && finalHead !== 'DROPPED') {
        GitExec.run(`git update-ref refs/heads/${branch} ${finalHead}`, {}, cwd);
        GitExec.run(`git reset --hard ${finalHead}`, {}, cwd);
      }

      Logger.success(
        `Self-healing complete! Repaired history successfully (Dropped: ${droppedCount}, Shifted: ${shiftedCount}).`
      );
      return true;
    } catch (err: any) {
      Logger.error(`Plumbing self-healing failed: ${err.message}. Cleaning state...`);
      Healer.cleanupRebaseState(cwd);
      return false;
    }
  }
}

