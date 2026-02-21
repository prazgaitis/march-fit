# Point Ledger + Aggregate Architecture

Date: 2026-02-21  
Owner: Backend

## Problem

Point totals are currently computed in multiple places with mixed patterns:

- Read paths often scan `activities` and reduce in memory.
- Write paths update `activities`, `userChallenges.totalPoints`, and streaks in multiple mutations.
- Side effects are duplicated and can drift.

We need a single maintainable path for point-altering behavior that remains atomic and testable.

## Goals

1. One source of truth for challenge/user point totals.
2. One service path for all point-altering activity writes.
3. Keep Convex transaction atomicity.
4. Improve read performance for leaderboard/profile totals.
5. Make behavior testable with clear contracts.

## Non-goals

1. Do not replace Convex as the transaction engine.
2. Do not fully abstract every database operation in the codebase.
3. Do not remove existing streak/participation semantics in this iteration.

## Proposed Design

### 1. Aggregate-backed totals

Use `@convex-dev/aggregate` with one component instance:

- Component name: `activityPointsAggregate`
- Table: `activities`
- Namespace: `challengeId`
- Sort key: `[userId, activityId]`
- Sum value: `deletedAt === undefined ? pointsEarned : 0`

This lets us query per-user totals in a challenge using `sumBatch` with `bounds.prefix = [userId]`.

### 2. Centralized activity write service

Introduce `packages/backend/lib/activityWrites.ts` as the canonical write layer for `activities`:

- `insertActivity(ctx, value)`
- `patchActivity(ctx, activityId, patch)`
- `deleteActivity(ctx, activityId)` for hard delete flows

Responsibilities:

1. Read old/new docs as needed.
2. Persist `activities` change.
3. Keep aggregate in sync (`insertIfDoesNotExist`, `replaceOrInsert`, `deleteIfExists`).

Notes:

- This layer synchronizes the aggregate only.
- Participation/streak updates remain explicit at call sites in phase 1, then can move into a higher-level ledger operation in phase 2.

### 3. Point ledger service (phase 2)

Introduce a higher-level orchestration service (e.g. `pointLedger.ts`) for all point-altering operations:

- `logActivity(...)`
- `editActivityPoints(...)`
- `softDeleteActivity(...)`
- `restoreActivity(...)`
- `awardBonusActivity(...)`

Each operation performs:

1. Activity write via `activityWrites`.
2. Participation total delta update.
3. Streak recomputation (where relevant).
4. Optional history/notification hooks.

This collapses duplicate logic currently in `activities`, `stravaWebhook`, `apiMutations`, `admin`, `miniGames`, `rescoreStrava`.

### 4. Thin abstraction for testability (not full DB rewrite)

Define narrow interfaces for business logic inputs (activity repo + participation repo + clock).  
Provide:

1. Convex adapter in production (atomic via mutation transaction).
2. In-memory/fake adapters for pure unit tests.

Atomic correctness is still primarily validated with `convex-test`.

## Why this is maintainable

1. One write API for activity rows eliminates missed side effects.
2. Aggregate-backed reads remove repeated full-table scans.
3. Thin interfaces keep logic testable without losing Convex guarantees and types.
4. Incremental migration reduces rollout risk.

## Migration Plan

### Phase 0: Foundations

1. Add aggregate component to `packages/backend/convex.config.ts`.
2. Add aggregate helper module and `activityWrites`.
3. Switch core read helper (`challengePoints`) to aggregate.

### Phase 1: Migrate high-traffic writes

1. `mutations/activities.ts`
2. `mutations/stravaWebhook.ts`
3. `mutations/apiMutations.ts`

### Phase 2: Migrate remaining writes

1. `mutations/admin.ts`
2. `mutations/miniGames.ts`
3. `mutations/rescoreStrava.ts`
4. `mutations/cleanup.ts`

### Phase 3: Backfill + hardening

1. Backfill aggregate from existing `activities`.
2. Add invariant checks/repair tooling.
3. Optionally retire stale `userChallenges.totalPoints` dependencies in read paths.

## Testing Strategy

1. Unit tests for aggregate helper:
- per-user totals
- deleted activities excluded from sum
- replace/restore updates totals correctly

2. Integration tests (`convex-test`) for mutations:
- log/edit/delete/restore flows keep aggregate totals correct
- participation totals and streaks remain unchanged semantically
- rollback behavior: injected error in operation should leave no partial side effects

3. Regression tests in existing API suites:
- leaderboard/profile totals match expected values
- mini-game/achievement bonus activities still apply correctly

## Risks and Mitigations

1. Risk: missed write path leaves aggregate stale.  
Mitigation: grep-based migration checklist + tests for each point-altering mutation file.

2. Risk: behavior drift between participation totals and aggregate totals.  
Mitigation: temporary assertion tests compare both during migration.

3. Risk: operational backfill mistakes.  
Mitigation: idempotent aggregate APIs + staged rollout (write-sync first, read cutover second).

## Success Criteria

1. All challenge point read paths use aggregate helper.
2. All activity writes use centralized write service.
3. No full-scan point reducers remain in hot query paths.
4. Tests cover point-altering flows and pass in CI.
