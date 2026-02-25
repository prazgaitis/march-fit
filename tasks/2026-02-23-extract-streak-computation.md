# 2026-02-23 Extract streak computation into shared pure function with tests

## Summary
Consolidate duplicated streak computation from `participationScoring.ts` and `queries/users.ts` into a single pure module with tests.

## Tasks
- [x] Create `packages/backend/lib/streak.ts` with `aggregateDailyStreakPoints` and `computeStreak`
- [x] Refactor `packages/backend/lib/participationScoring.ts` to use shared functions
- [x] Refactor `packages/backend/queries/users.ts` `getProfile` to use shared functions
- [x] Add tests in `apps/web/tests/lib/streak.test.ts`
- [x] Verify: `pnpm test -- --run`, `pnpm typecheck`
