# Fix Hunt Week Double-Counting Bug

**Date:** 2026-03-27

## Root Cause

`getHuntWeekLeaderboard()` computed each player's score as:

```
initialState.points + getPointsInPeriod(startsAt, endsAt)
```

- `initialState.points` is captured from `userChallenges.totalPoints` at game start (e.g. 18:05 UTC on Mar 15).
- `getPointsInPeriod` counts activities where `loggedDate >= startsAt`, and `startsAt` is midnight UTC on Mar 15.
- Activities logged between 00:00 and 18:05 UTC on Mar 15 were already in `initialState.points` **and** matched by `loggedDate >= startsAt` — double-counted.

The magnitude varies per player (depends on how many activities they logged before the game started on the start date), distorting the Hunt Week leaderboard and potentially flipping predator/prey outcomes.

## Fix

- [x] Replace score reconstruction (`initialState.points + periodPoints`) with `getPointsUpToDate()` — sums all non-deleted, non-mini-game activities with `loggedDate <= endsAt`
- [x] Update hunt week tests to create backing activities instead of relying on `totalPoints` set without activities

Uses a single source of truth (activities table bounded by `endsAt`) rather than reconstructing from two overlapping sources. Also correctly excludes post-game activities.

## Affected Data

The Mar 15-21 Hunt Week game has already been ended with the double-counted leaderboard. To remediate:

1. Identify the Hunt Week miniGame document for Mar 15-21
2. Delete `source: "mini_game"` bonus activities awarded when that game ended
3. Set the game status back to `"active"`, then call `end` again — the new code will use `getPointsUpToDate` and award correct bonuses
