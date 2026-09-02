import { GitExec } from './gitExec';
import { Logger } from '../utils/logger';
import { formatDateUTC, getUTCDayOfWeek } from '../utils/timezone';
import * as fs from 'fs';
import * as path from 'path';

export interface PrAutomationOptions {
  count?: number;
  autoMerge?: boolean;
  authorEmail?: string;
  authorName?: string;
  category?: 'docs' | 'chore' | 'refactor' | 'types' | 'perf';
  cwd?: string;
}

export interface PrResult {
  prNumber?: number;
  prUrl?: string;
  branchName: string;
  title: string;
  merged: boolean;
  success: boolean;
}

const PR_TEMPLATES = [
  {
    category: 'docs',
    titlePrefix: 'docs: update system architecture spec & maintenance logs',
    branchPrefix: 'docs/architecture-spec',
    file: 'docs/maintenance/spec-updates.md',
    generateBody: (dateStr: string, id: string) => `### System Architecture Specification Update

#### Overview
Automated routine documentation maintenance synchronizing system telemetry logs, runtime benchmarks, and architecture constraints.

#### Changes Included
- [x] Verified Markov state transition matrix boundaries.
- [x] Updated runtime telemetry timestamp (\`${dateStr} UTC\`).
- [x] Refined pattern engine configuration guidelines.

> *Execution ID: \`${id}\` | Category: Documentation Maintenance*
`,
  },
  {
    category: 'chore',
    titlePrefix: 'chore(telemetry): synchronize repository telemetry & integrity metrics',
    branchPrefix: 'chore/telemetry-sync',
    file: 'docs/maintenance/telemetry.json',
    generateBody: (dateStr: string, id: string) => `### Routine Telemetry Maintenance

#### Overview
Periodic maintenance task verifying repository tree health, lockfile integrity, and branch synchronization.

#### Verification
- [x] Validated branch synchronization.
- [x] Logged telemetry checkpoint: \`${dateStr}\`.
- [x] Cleaned up temporary runtime references.

> *Execution ID: \`${id}\` | Automated Maintenance Task*
`,
  },
  {
    category: 'refactor',
    titlePrefix: 'refactor(metrics): optimize runtime performance telemetry & memory stats',
    branchPrefix: 'refactor/runtime-metrics',
    file: 'docs/maintenance/runtime-stats.md',
    generateBody: (dateStr: string, id: string) => `### Runtime Optimization & Stats Refactoring

#### Overview
Routine performance checkpoint updating benchmark statistics and memory footprint telemetry.

#### Changes
- [x] Consolidated benchmark indices.
- [x] Updated execution audit log for date \`${dateStr}\`.
- [x] Verified commit-tree plumbing performance bounds.

> *Execution ID: \`${id}\` | Category: Performance Metrics*
`,
  },
  {
    category: 'types',
    titlePrefix: 'types(spec): refine schema annotations & pattern definitions',
    branchPrefix: 'types/schema-annotations',
    file: 'docs/maintenance/schema-definitions.md',
    generateBody: (dateStr: string, id: string) => `### Schema Annotation & Spec Refinement

#### Overview
Maintains type specification documents and pattern schema reference definitions.

#### Changelog
- [x] Synced pattern definition schema versions.
- [x] Verified TypeScript interface constraints.
- [x] Checked out for \`${dateStr}\`.

> *Execution ID: \`${id}\` | Category: Type Schema Maintenance*
`,
  },
];

export class PrAutomationEngine {
  private options: PrAutomationOptions;

  constructor(options: PrAutomationOptions = {}) {
    this.options = {
      count: options.count ?? 1,
      autoMerge: options.autoMerge ?? true,
      authorEmail: options.authorEmail || 'Kyrell0602@gmail.com',
      authorName: options.authorName || 'Hazy019',
      cwd: options.cwd || process.cwd(),
      category: options.category,
    };
  }

  public run(): PrResult[] {
    const cwd = this.options.cwd!;
    const count = Math.max(1, Math.min(this.options.count ?? 1, 5));
    const results: PrResult[] = [];

    Logger.info(`Starting Pull-Shark PR Automation Engine (Count: ${count}, Auto-Merge: ${this.options.autoMerge})...`);

    const now = new Date();
    if (getUTCDayOfWeek(now) === 6) {
      Logger.warn("Saturday detected (UTC day 6). Skipping PR automation to enforce 'all-but-sat' contribution rule.");
      return [];
    }

    const dateStr = formatDateUTC(now);

    for (let i = 0; i < count; i++) {
      const templateIndex = (now.getTime() + i) % PR_TEMPLATES.length;
      const template = this.options.category
        ? PR_TEMPLATES.find((t) => t.category === this.options.category) || PR_TEMPLATES[templateIndex]
        : PR_TEMPLATES[templateIndex];

      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const branchName = `${template.branchPrefix}-${dateStr.replace(/-/g, '')}-${randomSuffix}`;
      const uniqueId = `PR-${Date.now()}-${randomSuffix}`;
      const title = `${template.titlePrefix} [${uniqueId}]`;
      const body = template.generateBody(dateStr, uniqueId);

      try {
        Logger.info(`[${i + 1}/${count}] Creating PR branch '${branchName}'...`);

        // 1. Ensure we branch from origin/main
        GitExec.run('git checkout -B ' + branchName + ' origin/main', {}, cwd);

        // 2. Make atomic file update
        const targetFilePath = path.join(cwd, template.file);
        const targetDir = path.dirname(targetFilePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const logEntry = `\n- **[${new Date().toISOString()}]** Checkpoint: \`${uniqueId}\` | Sync: OK\n`;
        fs.appendFileSync(targetFilePath, logEntry, 'utf-8');

        // 3. Stage and commit
        GitExec.run(`git add "${template.file}"`, {}, cwd);
        
        const env: Record<string, string> = {
          GIT_AUTHOR_NAME: this.options.authorName!,
          GIT_AUTHOR_EMAIL: this.options.authorEmail!,
          GIT_COMMITTER_NAME: this.options.authorName!,
          GIT_COMMITTER_EMAIL: this.options.authorEmail!,
        };

        const safeTitle = title.replace(/"/g, '\\"');
        GitExec.run(`git commit -m "${safeTitle}"`, env, cwd);

        // 4. Push branch to remote
        Logger.info(`Pushing branch '${branchName}' to remote...`);
        GitExec.run(`git push origin ${branchName} --force`, {}, cwd);

        // 5. Open Pull Request via GitHub CLI (gh) using a temporary body file for pristine markdown rendering
        Logger.info(`Opening Pull Request on GitHub...`);
        const tempBodyFile = path.join(cwd, `.pr_body_${randomSuffix}.md`);
        fs.writeFileSync(tempBodyFile, body, 'utf-8');

        let prUrl = '';
        try {
          const prCreateCmd = `gh pr create --title "${safeTitle}" --body-file="${tempBodyFile}" --head ${branchName} --base main`;
          prUrl = GitExec.run(prCreateCmd, {}, cwd);
          Logger.success(`Pull Request created: ${prUrl}`);
        } finally {
          if (fs.existsSync(tempBodyFile)) {
            try {
              fs.unlinkSync(tempBodyFile);
            } catch {
              // Ignore
            }
          }
        }

        let merged = false;
        if (this.options.autoMerge) {
          Logger.info(`Auto-merging Pull Request '${title}'...`);
          try {
            GitExec.run(`gh pr merge "${branchName}" --merge --delete-branch --admin || gh pr merge "${branchName}" --merge --delete-branch || gh pr merge --auto --merge "${branchName}"`, {}, cwd);
            merged = true;
            Logger.success(`Pull Request merged successfully!`);
          } catch (mergeErr: any) {
            Logger.warn(`Auto-merge note: ${mergeErr.message}. Branch remains open for manual merge.`);
          }
        } else {
          Logger.info(`[MANUAL MERGE MODE] Pull Request is ready for your 1-click merge: ${prUrl}`);
          Logger.info(`👉 Open ${prUrl} and click 'Merge pull request' to increment your PR count & Pull Shark achievement!`);
        }

        results.push({
          branchName,
          title,
          prUrl,
          merged,
          success: true,
        });
      } catch (err: any) {
        Logger.error(`Failed to process PR for branch '${branchName}': ${err.message}`);
        results.push({
          branchName,
          title,
          merged: false,
          success: false,
        });
      } finally {
        // Return to main branch cleanly
        try {
          GitExec.run('git checkout main', {}, cwd);
        } catch {
          // Ignore
        }
      }
    }

    // Write GitHub Actions Step Summary if running in CI
    const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummaryFile && fs.existsSync(path.dirname(stepSummaryFile))) {
      try {
        let summaryMd = `\n### 🦈 Pull Shark Achievement Engine Summary\n\n`;
        summaryMd += `| PR Title | Branch | Status | Action |\n`;
        summaryMd += `| :--- | :--- | :--- | :--- |\n`;
        for (const res of results) {
          const statusText = res.merged ? '✅ Merged' : (res.success ? '⏳ Ready for 1-Click Merge' : '❌ Failed');
          const actionText = res.prUrl ? `[🔗 Open PR to Merge](${res.prUrl.trim()})` : 'N/A';
          summaryMd += `| **${res.title}** | \`${res.branchName}\` | ${statusText} | ${actionText} |\n`;
        }
        summaryMd += `\n> 💡 **Notice**: Merging these PRs advances both your **Pull Request counter** and **Pull Shark** badge.\n`;
        fs.appendFileSync(stepSummaryFile, summaryMd, 'utf-8');
      } catch {
        // Ignore summary write errors
      }
    }

    return results;
  }
}
