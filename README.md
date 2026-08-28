# commit-canvas-filter

> Automated procedural git contribution engine that populates a 7x52 activity grid for all days of the week except Saturday.

## Architecture

The project enforces logical separation of pattern rules from commit execution:
`Grid Iterator` -> `Pattern Decision Engine` -> `Commit Execution` -> `History Verifier`.

- **`/src/config`**: Intensity rules (Levels 1–4, default Level 2 = 5–60 organic spectrum commits/day) and `all-but-sat` pattern definition.
- **`/src/logic`**: `DateIterator` for ISO 8601 calendar over 52 weeks and `DayOfWeekFilter` enforcing Saturday skips (`getUTCDay() === 6`).
- **`/src/engine`**: `GitExec` using `git commit --allow-empty` with `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` overrides, deterministic signatures `[commit-canvas-filter:YYYY-MM-DD:weekday:idx/total]`, and idempotency checking.
- **`/src/utils`**: Strict UTC date handling and ASCII 7x52 terminal grid visual renderer.

## Installation & Setup

```bash
npm install
npm run build
```

## CLI Usage

### 1. Preview Activity Grid (`preview`)
Renders an ASCII 7x52 grid in the terminal showing planned commits and skipped Saturdays without modifying git history:

```bash
npm run preview
# or
npx ts-node src/cli.ts preview --weeks 52 --intensity 2
```

### 2. Execute Commit Pattern (`sync`)
Executes deterministic empty commits for active days in the target timeline window. Supports `--dry-run` to test execution:

```bash
# Dry run
npx ts-node src/cli.ts sync --dry-run

# Live sync onto current branch
npm run sync
```

### 3. Verify Git History (`verify`)
Audits current branch git history to guarantee zero Saturday commits exist and all pattern commits comply with rules:

```bash
npm run verify
# or
npx ts-node src/cli.ts verify --pattern=all-but-sat
```

### 4. Pull Shark Achievement Automation (`pr-sync`)
Automates creation and optional merging of maintenance pull requests to advance GitHub's **Pull Shark** badge:

```bash
# Generate 1 PR ready for 1-click manual merge
npx ts-node src/cli.ts pr-sync --count=1 --category=docs --auto-merge=false

# Auto-merge PR immediately
npx ts-node src/cli.ts pr-sync --count=1 --auto-merge=true
```

### 5. Pair Extraordinaire Achievement Automation (`pair-sync`)
Automates pull request creation with co-authored git commits to advance GitHub's **Pair Extraordinaire** badge:

```bash
# Generate 1 co-authored PR for 1-click manual merge
npx ts-node src/cli.ts pair-sync --count=1 --coauthor-name="Mitakashim3" --coauthor-email="Mitakashim3@users.noreply.github.com" --auto-merge=false
```

## Running Unit Tests

```bash
npm test
```

## GitHub Actions Automated Pipelines

1. **Commit Canvas Daily Sync** (`.github/workflows/commit-canvas.yml`): Runs daily at `00:00 UTC` to maintain activity grids.
2. **Pull Shark Engine** (`.github/workflows/pull-shark.yml`): Runs weekday PR automation for Pull Shark milestone progression.
3. **Pair Extraordinaire Engine** (`.github/workflows/pair-extraordinaire.yml`): Runs weekday collaborative PR automation with co-authorship trailers and 1-click manual merge.
