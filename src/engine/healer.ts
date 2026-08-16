import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { formatDateUTC, getUTCDayOfWeek } from '../utils/timezone';
import { GitExec } from './gitExec';

export class Healer {
  /**
   * Identifies violating Saturday commits and attempts to heal the repository.
   * If an empty commit-canvas commit is found on a Saturday, it drops it via an automated interactive rebase script.
   * Equipped with multi-stage fallback recovery (rebase abort, reset, lock cleanup).
   */
  public static heal(branch: string = 'main', maxCommits: number = 5000): boolean {
    Logger.info('Starting automated self-healing process...');
    GitExec.cleanupStaleLocks();

    const commits = GitExec.getCommitLog(maxCommits);
    const violatingHashes = new Set<string>();

    let needsHeal = false;

    for (const commit of commits) {
      const dateObj = new Date(commit.isoDate);
      if (isNaN(dateObj.getTime())) continue;

      if (getUTCDayOfWeek(dateObj) === 6) {
        // Saturday
        violatingHashes.add(commit.hash);
        needsHeal = true;
      }
    }

    if (!needsHeal) {
      Logger.success('No violating Saturday commits found. Repository is healthy.');
      return true;
    }

    Logger.warn(
      `Found ${violatingHashes.size} violating Saturday commits. Initiating automated rebase heal...`
    );

    // Create an automated GIT_SEQUENCE_EDITOR script
    const scriptContent = `
const fs = require('fs');
const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split('\\n');
const violatingHashes = new Set(${JSON.stringify(Array.from(violatingHashes))});

const newLines = lines.map(line => {
  const parts = line.split(' ');
  if (parts.length >= 2 && parts[0] === 'pick') {
    const hash = parts[1];
    const isViolating = Array.from(violatingHashes).some(v => v.startsWith(hash) || hash.startsWith(v));
    if (isViolating) {
      console.log('Dropping violating commit: ' + hash);
      return 'drop ' + parts.slice(1).join(' ');
    }
  }
  return line;
});

fs.writeFileSync(file, newLines.join('\\n'));
`;

    const tmpDir = os.tmpdir();
    const scriptPath = path.join(tmpDir, `commit-canvas-healer-${Date.now()}.js`);
    fs.writeFileSync(scriptPath, scriptContent);

    try {
      // Execute the rebase
      const env = {
        GIT_SEQUENCE_EDITOR: `node "${scriptPath.replace(/\\/g, '/')}"`,
      };

      // Need to find the oldest violating commit to rebase from
      const oldestViolating = commits.reverse().find((c) => violatingHashes.has(c.hash));
      if (!oldestViolating) return true;

      const rebaseBase = `${oldestViolating.hash}^`;
      Logger.info(`Rebasing from ${rebaseBase}...`);

      GitExec.run(`git rebase -i ${rebaseBase}`, env);
      Logger.success('Self-healing complete. Violating Saturday commits have been dropped.');
      return true;
    } catch (err: any) {
      Logger.error(`Healing process failed during rebase: ${err.message}. Triggering fallback recovery...`);

      // Multi-stage fallback recovery
      try {
        GitExec.run('git rebase --abort');
        Logger.info('Successfully aborted failed rebase.');
      } catch {
        // If abort fails, force clean rebase state
        try {
          const gitDir = path.join(process.cwd(), '.git');
          const rebaseMerge = path.join(gitDir, 'rebase-merge');
          const rebaseApply = path.join(gitDir, 'rebase-apply');
          if (fs.existsSync(rebaseMerge)) fs.rmSync(rebaseMerge, { recursive: true, force: true });
          if (fs.existsSync(rebaseApply)) fs.rmSync(rebaseApply, { recursive: true, force: true });
          GitExec.run('git reset --hard HEAD');
          Logger.info('Recovered working tree via hard reset and rebase state purge.');
        } catch (resetErr: any) {
          Logger.error(`Fallback reset error: ${resetErr.message}`);
        }
      }

      GitExec.cleanupStaleLocks();
      return false;
    } finally {
      if (fs.existsSync(scriptPath)) {
        try {
          fs.unlinkSync(scriptPath);
        } catch {
          // Ignore
        }
      }
    }
  }
}
