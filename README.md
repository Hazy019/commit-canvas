# commit-canvas-filter

> Automated procedural git contribution engine that populates a 7x52 activity grid for all days of the week except Saturday.

## Architecture

The project enforces logical separation of pattern rules from commit execution:
`Grid Iterator` -> `Pattern Decision Engine` -> `Commit Execution` -> `History Verifier`.

- **`/src/config`**: Intensity rules (Levels 1–4, default Level 2 = 5 commits/day) and `all-but-sat` pattern definition.
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

## Running Unit Tests

```bash
npm test
```

## GitHub Actions Automated Cron Pipeline

The workflow in `.github/workflows/commit-canvas.yml` runs daily at `00:00 UTC` and on `workflow_dispatch`. It automatically:
1. Runs `commit-canvas sync --pattern=all-but-sat --intensity=2`.
2. Runs `commit-canvas verify --pattern=all-but-sat`.
3. Pushes updated contribution history back to the main branch.
