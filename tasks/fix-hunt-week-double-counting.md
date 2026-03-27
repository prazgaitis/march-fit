# Fix Hunt Week Double-Counting Bug

**Date:** 2026-03-27

## Root Cause

`getHuntWeekLeaderboard()` computes each player's score as:

```
initialState.points + getPointsInPeriod(startsAt, endsAt)
```

- `initialState.points` is captured at game start time (e.g. 18:05:35 UTC on Mar 15).
- `getPointsInPeriod` counts activities where `loggedDate >= startsAt`, and `startsAt` is midnight UTC (00:00:00) on Mar 15.
- Activities logged between 00:00 UTC and 18:05 UTC on Mar 15 are already included in `initialState.points` **and** matched by the `loggedDate >= startsAt` filter — they are **double-counted**.

The magnitude varies per player (depends on how many activities they logged that morning before the game started), which distorts the Hunt Week leaderboard and can flip predator/prey outcomes.

## Fix (this PR)

- [x] Add `startedAt` field to `miniGames` schema
- [x] Store `startedAt: now` when a game transitions to `"active"`
- [x] Add `getHuntWeekPointsInPeriod()` helper that filters by `_creationTime > gameStartedAt` to exclude pre-game activities
- [x] Thread `gameStartedAt` through `getHuntWeekLeaderboard` → `calculateHuntWeekOutcomes` → `previewHuntWeekEnd`
- [x] Pass `miniGame.startedAt ?? miniGame.updatedAt` from both mutation and query callers

## Affected Data

The Mar 15-21 Hunt Week game (the only Hunt Week run so far) has already been ended. Its bonus awards were calculated with the double-counted leaderboard. Specific impacts:

- Players who logged activities the morning of Mar 15 before game start had inflated Hunt Week scores.
- This may have changed who "caught" their prey and who "was caught," affecting the +75 / -25 bonus distribution.

## Remediation Steps (Post-Merge)

After this PR is merged and deployed, a repo admin should remediate the existing Mar 15-21 game:

1. **Identify the game:** Find the Hunt Week miniGame document for Mar 15-21 in the Convex dashboard or via CLI:
   ```bash
   npx convex run miniGames:list '{}' --prod
   ```

2. **Revoke existing bonus awards:** Delete the `source: "mini_game"` bonus activities that were awarded when the game ended. These are the activities with descriptions like "Hunt Week Bonus" tied to participants of this game.

3. **Backfill `startedAt`:** Patch the miniGame document to set `startedAt` to the original activation timestamp. Check the `updatedAt` field or Convex audit log for the exact time the game went active (should be ~18:05 UTC on Mar 15).
   ```bash
   npx convex run --prod miniGames:backfillStartedAt '{"miniGameId": "<id>", "startedAt": <timestamp>}'
   ```
   (You may need to write a small one-off mutation for this.)

4. **Re-end the game:** Set the game status back to `"active"`, then call the `end` mutation again. The new code will use `startedAt` to correctly compute the leaderboard and award bonuses without double-counting.

5. **Verify:** Compare the new outcomes against the original to confirm the fix resolves the discrepancy. Check that affected players' total points are updated correctly.
