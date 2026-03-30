# 30-Day Streak Badge

**Date:** 2026-03-30

**Description:** Add a "streak" achievement criteria type and create a badge for participants who maintain a streak for the entire challenge.

## Changes

- [x] Add `streak` criteria type to schema, validators, and evaluation logic
- [x] `computeCriteriaProgress` accepts optional `context.currentStreak` for streak evaluation
- [x] `checkAndAwardAchievements` passes streak context when any achievement uses streak criteria
- [x] Backfill mutation passes streak context from participation record
- [x] Progress UI shows "X / Y days" for streak achievements
- [x] Tests for streak criteria (backfill award, below-threshold rejection, progress display)

## Post-deploy

After merge, create the achievement and badge on prod:

1. Create achievement with streak criteria (`requiredDays: 29` for the 29-day challenge)
2. Create badge linked to the achievement
3. Run backfill to award to all qualifying participants
