# 2026-02-28 Nightly Garbage Collection

Plan for implementing OpenAI-style "garbage collection" agents that run on a schedule
to continuously clean up the march-fit codebase.

## Background

From OpenAI's [Harness Engineering](https://openai.com/index/harness-engineering/) post:
the team initially spent 20% of their week (every Friday) manually cleaning up "AI slop."
They automated this by encoding golden principles and running recurring Codex tasks that
scan for deviations, grade quality, and open targeted refactoring PRs. The result is
continuous, low-cost attention to the maintenance work that compounds when ignored —
like garbage collection for your codebase.

Key quotes from the post:
> "On a regular cadence, we have a set of background Codex tasks that scan for
> deviations, update quality grades, and open targeted refactoring pull requests.
> Most of these can be reviewed in under a minute and automerged."
>
> "Technical debt is like a high-interest loan: it's almost always better to pay
> it down continuously in small increments than to let it compound."
>
> Their "golden principles" are "opinionated, mechanical rules that keep the
> codebase legible and consistent for future agent runs."

Examples of golden principles from the post:
1. Prefer shared utility packages over hand-rolled helpers (centralize invariants)
2. Don't probe data "YOLO-style" — validate boundaries or use typed SDKs

## Design Principles

1. **Each job is a single, focused prompt** — one concern per agent run
2. **Every job must be safe** — read-only analysis or auto-fixable changes only
3. **PRs over direct commits** — all changes open a PR for human review
4. **Self-verifying** — each job runs `pnpm typecheck && pnpm lint && pnpm test -- --run` before opening its PR
5. **Idempotent** — running twice produces no extra work if the codebase is already clean

## Proposed Nightly Jobs

### 1. Dead Export & Unused Code Sweeper
**Schedule:** Nightly
**What it does:** Finds exported functions/types/constants across `packages/backend` and
`apps/web` that have zero import sites. Opens a PR removing the dead code.
**Why:** AI-generated code tends to leave behind unused helpers and over-exported internals.
The codebase already had a `scoring-dead-code-cleanup` task — this makes it continuous.
**Verification:** `pnpm typecheck && pnpm lint && pnpm test -- --run`
**Prompt sketch:**
```
Search for all `export` declarations in packages/backend and apps/web/lib.
For each export, grep the rest of the codebase for import sites.
If an export has zero consumers outside its own file, remove it.
Do NOT touch _generated/ files, schema.ts, or index.ts barrel exports.
Run `pnpm typecheck && pnpm lint && pnpm test -- --run` to verify.
Open a PR titled "chore: remove dead exports [gc]".
```

### 2. Documentation Drift Detector
**Schedule:** Nightly
**What it does:** Compares CLAUDE.md and AGENTS.md against reality — checks that every
listed command actually exists in package.json, that directory trees are accurate, and
that referenced env vars appear in .env.example.
**Why:** Docs that drift from reality are worse than no docs — agents and humans both
rely on these files and get derailed by stale instructions.
**Verification:** Diff-only — produces a PR with corrections or opens an issue describing drift.
**Prompt sketch:**
```
Read CLAUDE.md and AGENTS.md. For every `pnpm <command>` mentioned, verify it
exists in the root or workspace package.json scripts. For every directory tree
shown, verify the directories exist. For every env var referenced, verify it
appears in .env.example. Open a PR fixing any drift found, or report "no drift"
and exit cleanly.
```

### 3. Inconsistent Date-Handling Auditor
**Schedule:** Weekly (Sundays)
**What it does:** Scans backend and frontend code for patterns that violate the local-date
semantics documented in CLAUDE.md — e.g., `new Date(...).toISOString().slice(0, 10)`,
raw UTC comparisons in daily rollups, missing `formatDateOnlyFromUtcMs` usage.
**Why:** This is a documented golden rule that's easy to violate. The codebase already
has date-handling notes in both CLAUDE.md and AGENTS.md — this enforces them mechanically.
**Verification:** Opens an issue or PR with findings. No blind refactoring.
**Prompt sketch:**
```
Search the codebase for these anti-patterns:
  - `.toISOString().slice(0, 10)` in daily rollup or grouping contexts
  - `new Date(loggedDate)` used for comparisons without formatDateOnlyFromUtcMs
  - Any backend code that infers a local date from UTC alone
Read the date-handling rules in CLAUDE.md. Flag violations as GitHub issues
with file:line references and suggested fixes.
```

### 4. Component Consistency Checker
**Schedule:** Nightly
**What it does:** Scans `apps/web/components` for patterns that drift from project
conventions — e.g., using raw `<img>` instead of `next/image` (unless intentionally
disabled per eslint config), inline styles where Tailwind classes exist, duplicated
UI patterns that could use existing shadcn components.
**Verification:** Opens a PR or issue with findings and suggestions.
**Prompt sketch:**
```
Scan apps/web/components and apps/web/app for:
  - Duplicated UI patterns (e.g., two different loading spinner implementations)
  - Inline style objects that could be Tailwind classes
  - Components that re-implement what an existing shadcn/ui component already does
    (check apps/web/components/ui for available primitives)
Open an issue summarizing findings with specific file:line references.
```

### 5. Dependency Hygiene
**Schedule:** Weekly (Saturdays)
**What it does:** Checks for unused dependencies in each workspace package.json
(installed but never imported), outdated packages with known security advisories,
and version mismatches across workspaces.
**Why:** AI agents `pnpm add` liberally. Unused deps bloat install times and attack surface.
**Verification:** `pnpm install --frozen-lockfile` still works after removals. `pnpm typecheck`.
**Prompt sketch:**
```
For each workspace (apps/web, packages/backend, packages/cli):
  - List every dependency in package.json
  - Grep the workspace source for imports of each dependency
  - Flag any dependency with zero import sites
  - Run `pnpm audit` and summarize any high/critical advisories
  - Run `pnpm syncpack:list` to check version consistency
Open a PR removing clearly unused deps. Open a separate issue for audit findings.
```

### 6. Stale Task File Cleanup
**Schedule:** Weekly (Mondays)
**What it does:** Scans `/tasks` for markdown files where all checkboxes are checked
and the file is older than 14 days. Opens a PR archiving them to `/tasks/archive/`.
**Why:** The tasks directory has 100+ files. Old completed tasks add noise for agents
scanning the directory for context.
**Prompt sketch:**
```
List all files in /tasks. For each file:
  - Parse checkbox items (- [x] and - [ ])
  - If ALL checkboxes are checked AND the date in the filename is >14 days ago,
    move it to /tasks/archive/
Skip files without dates in the filename (they may be ongoing).
Open a PR titled "chore: archive completed tasks [gc]".
```

### 7. Type Safety Tightener
**Schedule:** Nightly
**What it does:** Scans for `any` type annotations, non-null assertions (`!`), and
`@ts-ignore` / `@ts-expect-error` comments that may have been introduced by AI agents.
Opens an issue with a categorized list.
**Why:** AI agents reach for `any` and `!` when stuck. These escape hatches accumulate
silently and undermine TypeScript's value.
**Prompt sketch:**
```
Search the codebase (excluding _generated/, node_modules/, .next/) for:
  - Explicit `any` type annotations (`: any`, `as any`, `<any>`)
  - Non-null assertions (`!.` or `!;` patterns)
  - `@ts-ignore` and `@ts-expect-error` comments
For each finding, determine if it's justified (e.g., external API boundary)
or should be replaced with a proper type. Open an issue with a categorized list
and suggested fixes for the unjustified ones.
```

## Implementation Plan

### Phase 1 — Simplest valuable jobs (start here)
- [ ] Job 1: Dead Export Sweeper
- [ ] Job 2: Documentation Drift Detector
- [ ] Job 6: Stale Task File Cleanup

### Phase 2 — Domain-specific checks
- [ ] Job 3: Date-Handling Auditor
- [ ] Job 7: Type Safety Tightener

### Phase 3 — Broader quality
- [ ] Job 4: Component Consistency Checker
- [ ] Job 5: Dependency Hygiene

## How to Wire It Up

Since you have a way to kick off agentic coding tasks on a schedule, each job above
becomes a scheduled task with:

1. **A prompt file** (e.g., `.github/gc-prompts/dead-exports.md`) containing the full
   agent instructions, golden rules, and verification steps
2. **A schedule trigger** — cron-based (nightly at 4 AM UTC, or weekly) that invokes
   the coding agent with the prompt file against a fresh branch
3. **Branch naming convention** — `gc/<job-name>-<date>` (e.g., `gc/dead-exports-2026-02-28`)
4. **Auto-PR** — the agent opens a PR with a `[gc]` label for easy filtering
5. **Self-check gate** — every prompt includes `pnpm typecheck && pnpm lint && pnpm test -- --run`
   as a mandatory step before opening the PR

### Directory Structure
```
.github/
  gc-prompts/
    dead-exports.md
    doc-drift.md
    date-handling.md
    component-consistency.md
    dependency-hygiene.md
    stale-tasks.md
    type-safety.md
```

Each prompt file is a self-contained agent instruction set — it references CLAUDE.md
for project context, specifies exactly what to scan, how to verify, and what PR to open.

## Metrics to Track

- **PRs opened per week** by `[gc]` label
- **PRs merged vs. closed without merge** (signal for prompt quality)
- **Time from PR open to merge** (should be <5 min for good GC PRs)
- **Lint/typecheck/test regressions** caught before merge (signal for self-check quality)
