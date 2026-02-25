# 2026-02-23 Streak Bonus Points

Streaks award bonus points: each qualifying streak day earns bonus = its running streak count (day 1 = +1, day 5 = +5). If a streak breaks and restarts, the count resets. Bonus points count toward leaderboard `totalPoints`.

## Changes

- [x] Schema: add `streakBonusPoints: v.optional(v.number())` to `userChallenges`
- [x] `lib/streak.ts`: add `computeTotalStreakBonus()` and `totalStreakBonus` to `StreakResult`
- [x] `lib/participationScoring.ts`: compute streak bonus delta and apply to `totalPoints`
- [x] `queries/users.ts`: add `totalStreakBonusPoints` to `streakCalendar` response
- [x] `streak-calendar-card.tsx`: show bonus in tooltip and summary footer
- [x] `user-profile-content.tsx`: pass `totalStreakBonusPoints` prop
- [x] Unit tests for `computeTotalStreakBonus` and `totalStreakBonus` field
- [x] Updated existing test assertions to account for streak bonus in `totalPoints`

## Verification

- `pnpm typecheck` — clean
- `pnpm test -- --run` — all 389 tests pass (31 files)
