# 2026-02-23: Score Verification Action + Streak Bonus Integration Tests

## Summary
Added a `verifyUserScore` internalMutation for detecting and fixing totalPoints drift, plus integration tests for streak bonus point flow through the system.

## Changes

### `packages/backend/mutations/verifyScores.ts` (New)
- [x] `verifyUserScore` internalMutation with args: `challengeId`, optional `userId`, `fix` boolean
- [x] Recomputes totalPoints from scratch: sum(activity.pointsEarned) + streak bonus
- [x] Reuses `aggregateDailyStreakPoints` + `computeStreak` from `lib/streak.ts`
- [x] Compares stored vs expected `totalPoints`, `streakBonusPoints`, `currentStreak`
- [x] When `fix=true`, patches participation record to correct values
- [x] Returns per-user diff report with mismatch count

### `apps/web/tests/api/streak-bonus.test.ts` (New)
- [x] Single qualifying day: streakBonusPoints=1, totalPoints=activityPts+1
- [x] 3 consecutive days: streakBonusPoints=6, totalPoints=36
- [x] Delete middle day: streak splits, bonus recalculated, totalPoints decreases
- [x] Non-streak activity: streakBonusPoints unchanged
- [x] Below-threshold day: no streak bonus
- [x] Leaderboard ranking: user with streak outranks user with same activity pts but no streak
- [x] Verify action: corrupt totalPoints, run verify (dry+fix), confirms detection and correction

## Verification
- [x] `pnpm typecheck` — clean
- [x] `pnpm test -- --run` — all 32 test files pass (396 tests passed)
