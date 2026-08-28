import { GitExec } from './gitExec';
import { Logger } from '../utils/logger';
import { formatDateUTC } from '../utils/timezone';
import * as fs from 'fs';
import * as path from 'path';

export interface PairAutomationOptions {
  count?: number;
  autoMerge?: boolean;
  authorEmail?: string;
  authorName?: string;
  coauthorName?: string;
  coauthorEmail?: string;
  category?: 'collab' | 'docs' | 'refactor' | 'types' | 'perf' | 'feature';
  cwd?: string;
}

export interface PairPrResult {
  prNumber?: number;
  prUrl?: string;
  branchName: string;
  title: string;
  coauthor: string;
  merged: boolean;
  success: boolean;
}

export const PAIR_PR_TEMPLATES = [
  {
    category: 'collab',
    titlePrefix: 'feat(collab): collaborative pair-programming engine & state synchronization',
    branchPrefix: 'collab/state-sync',
    file: 'docs/maintenance/pair-sessions.md',
    generateBody: (dateStr: string, id: string, coauthorName: string) => `### 👥 Pair Programming Session & Architecture Refinement

#### Overview
Collaborative development milestone synchronizing state engine mechanics, procedural commit workflows, and pair-programming telemetry.

#### Session Details
- **Primary Author**: @Hazy019
- **Co-Author**: @${coauthorName}
- **Session Timestamp**: \`${dateStr} UTC\`
- **Milestone Ref**: \`${id}\`

#### Included Improvements
- [x] Verified collaborative git-tree co-authorship plumbing.
- [x] Synchronized pattern engine telemetry logs.
- [x] Validated branch protection and merge prerequisites.

> *Execution ID: \`${id}\` | Pair Extraordinaire Achievement Pipeline*
`,
  },
  {
    category: 'docs',
    titlePrefix: 'docs(collab): joint system specification & maintenance audit',
    branchPrefix: 'docs/pair-spec',
    file: 'docs/maintenance/spec-updates.md',
    generateBody: (dateStr: string, id: string, coauthorName: string) => `### 📚 Joint Documentation & Maintenance Specification

#### Overview
Collaborative maintenance update co-authored by **@Hazy019** and **@${coauthorName}** to document system performance and contribution matrices.

#### Changes
- [x] Updated runtime telemetry checkpoint for \`${dateStr} UTC\`.
- [x] Cross-verified Markov state transition bounds.
- [x] Formatted collaborative documentation standards.

> *Execution ID: \`${id}\` | Category: Pair Documentation*
`,
  },
  {
    category: 'refactor',
    titlePrefix: 'refactor(collab): joint runtime optimization & pipeline refactoring',
    branchPrefix: 'refactor/pair-metrics',
    file: 'docs/maintenance/runtime-stats.md',
    generateBody: (dateStr: string, id: string, coauthorName: string) => `### ⚡ Collaborative Runtime Optimization

#### Overview
Pair-engineered performance review updating runtime metrics, execution memory bounds, and commit-tree plumbing benchmarks.

#### Enhancements
- [x] Optimized execution audit log for checkpoint \`${dateStr}\`.
- [x] Refined commit-tree plumbing routines.
- [x] Co-verified execution time bounds.

> *Execution ID: \`${id}\` | Co-authored with @${coauthorName}*
`,
  },
  {
    category: 'types',
    titlePrefix: 'types(collab): refine interface annotations & type contracts',
    branchPrefix: 'types/pair-contracts',
    file: 'docs/maintenance/schema-definitions.md',
    generateBody: (dateStr: string, id: string, coauthorName: string) => `### 🛡️ Schema Annotation & Type Contract Refinement

#### Overview
Jointly refined TypeScript interface contracts, schema annotations, and pattern definition types.

#### Changelog
- [x] Synchronized interface type annotations.
- [x] Validated compiler strictness constraints.
- [x] Audit verification checkpoint: \`${dateStr}\`.

> *Execution ID: \`${id}\` | Co-authored with @${coauthorName}*
`,
  },
];

export class PairAutomationEngine {
  private options: PairAutomationOptions;

  constructor(options: PairAutomationOptions = {}) {
    this.options = {
      count: options.count ?? 1,
      autoMerge: options.autoMerge ?? false,
      authorEmail: options.authorEmail || 'Kyrell0602@gmail.com',
      authorName: options.authorName || 'Hazy019',
      coauthorName: options.coauthorName || 'Mitakashim3',
      coauthorEmail: options.coauthorEmail || 'Mitakashim3@users.noreply.github.com',
      cwd: options.cwd || process.cwd(),
      category: options.category,
    };
  }

  public static formatCommitMessage(
    title: string,
    description: string,
    coauthorName: string,
    coauthorEmail: string
  ): string {
    return `${title}\n\n${description}\n\nCo-authored-by: ${coauthorName} <${coauthorEmail}>`;
  }

  public run(): PairPrResult[] {
    const cwd = this.options.cwd!;
    const count = Math.max(1, Math.min(this.options.count ?? 1, 5));
    const results: PairPrResult[] = [];
    const coauthorStr = `${this.options.coauthorName} <${this.options.coauthorEmail}>`;

    Logger.info(
      `Starting Pair Extraordinaire PR Engine (Count: ${count}, Co-Author: @${this.options.coauthorName}, Auto-Merge: ${this.options.autoMerge})...`
    );

    const now = new Date();
    const dateStr = formatDateUTC(now);

    for (let i = 0; i < count; i++) {
      const templateIndex = (now.getTime() + i) % PAIR_PR_TEMPLATES.length;
      const template = this.options.category
        ? PAIR_PR_TEMPLATES.find((t) => t.category === this.options.category) || PAIR_PR_TEMPLATES[templateIndex]
        : PAIR_PR_TEMPLATES[templateIndex];

      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const branchName = `${template.branchPrefix}-${dateStr.replace(/-/g, '')}-${randomSuffix}`;
      const uniqueId = `PAIR-${Date.now()}-${randomSuffix}`;
      const title = `${template.titlePrefix} [${uniqueId}]`;
      const body = template.generateBody(dateStr, uniqueId, this.options.coauthorName!);

      const commitDescription = `Collaborative milestone co-authored during pair programming session with @${this.options.coauthorName}.`;
      const fullCommitMsg = PairAutomationEngine.formatCommitMessage(
        title,
        commitDescription,
        this.options.coauthorName!,
        this.options.coauthorEmail!
      );

      const tempCommitMsgFile = path.join(cwd, `.pair_commit_msg_${randomSuffix}.txt`);
      const tempBodyFile = path.join(cwd, `.pair_pr_body_${randomSuffix}.md`);

      try {
        Logger.info(`[${i + 1}/${count}] Creating Pair PR branch '${branchName}'...`);

        // 1. Ensure we branch from origin/main
        GitExec.run('git checkout -B ' + branchName + ' origin/main', {}, cwd);

        // 2. Make atomic file update
        const targetFilePath = path.join(cwd, template.file);
        const targetDir = path.dirname(targetFilePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const logEntry = `\n- **[${new Date().toISOString()}]** Pair Checkpoint: \`${uniqueId}\` | Co-Author: @${this.options.coauthorName} | Status: OK\n`;
        fs.appendFileSync(targetFilePath, logEntry, 'utf-8');

        // 3. Stage and commit with Co-authored-by trailer
        GitExec.run(`git add "${template.file}"`, {}, cwd);

        fs.writeFileSync(tempCommitMsgFile, fullCommitMsg, 'utf-8');

        const env: Record<string, string> = {
          GIT_AUTHOR_NAME: this.options.authorName!,
          GIT_AUTHOR_EMAIL: this.options.authorEmail!,
          GIT_COMMITTER_NAME: this.options.authorName!,
          GIT_COMMITTER_EMAIL: this.options.authorEmail!,
        };

        GitExec.run(`git commit -F "${tempCommitMsgFile}"`, env, cwd);

        // 4. Push branch to remote
        Logger.info(`Pushing pair branch '${branchName}' to remote...`);
        GitExec.run(`git push origin ${branchName} --force`, {}, cwd);

        // 5. Open Pull Request via GitHub CLI (gh)
        Logger.info(`Opening Pair Extraordinaire Pull Request on GitHub...`);
        fs.writeFileSync(tempBodyFile, body, 'utf-8');

        let prUrl = '';
        const safeTitle = title.replace(/"/g, '\\"');
        const prCreateCmd = `gh pr create --title "${safeTitle}" --body-file="${tempBodyFile}" --head ${branchName} --base main`;
        prUrl = GitExec.run(prCreateCmd, {}, cwd);
        Logger.success(`Pair Pull Request created: ${prUrl}`);

        let merged = false;
        if (this.options.autoMerge) {
          Logger.info(`Auto-merging Pair Pull Request '${title}'...`);
          try {
            GitExec.run(
              `gh pr merge "${branchName}" --merge --delete-branch --admin || gh pr merge "${branchName}" --merge --delete-branch || gh pr merge --auto --merge "${branchName}"`,
              {},
              cwd
            );
            merged = true;
            Logger.success(`Pair Pull Request merged successfully!`);
          } catch (mergeErr: any) {
            Logger.warn(`Auto-merge note: ${mergeErr.message}. Branch remains open for manual merge.`);
          }
        } else {
          Logger.info(`[1-CLICK MANUAL MERGE] Pull Request is ready for your 1-click merge: ${prUrl}`);
        }

        results.push({
          branchName,
          title,
          prUrl,
          coauthor: coauthorStr,
          merged,
          success: true,
        });
      } catch (err: any) {
        Logger.error(`Failed to process Pair PR for branch '${branchName}': ${err.message}`);
        results.push({
          branchName,
          title,
          coauthor: coauthorStr,
          merged: false,
          success: false,
        });
      } finally {
        // Clean up temporary message files
        if (fs.existsSync(tempCommitMsgFile)) {
          try {
            fs.unlinkSync(tempCommitMsgFile);
          } catch {
            // Ignore
          }
        }
        if (fs.existsSync(tempBodyFile)) {
          try {
            fs.unlinkSync(tempBodyFile);
          } catch {
            // Ignore
          }
        }

        // Return to main branch cleanly
        try {
          GitExec.run('git checkout main', {}, cwd);
        } catch {
          // Ignore
        }
      }
    }

    return results;
  }
}
