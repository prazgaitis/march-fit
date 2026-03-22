# Fix Ledger Grand Total Math

**Date:** 2026-03-22

## Problem

The Grand Total on the user ledger page did not equal the sum of all day totals.

## Root Cause

The ledger query (`getLedger` in `packages/backend/queries/users.ts`) returned
`participation.totalPoints` as the grand total. This is a **denormalized/cached**
value stored on the `userChallenges` table. It can drift from the actual sum of
activities + streak bonuses because multiple code paths increment it independently:

- Normal activity scoring (`applyParticipationScoreDeltaAndRecomputeStreak`)
- Mini-game bonuses (direct `totalPoints +=` in `miniGames.ts`)
- Achievement bonuses (direct `totalPoints +=` in `activities.ts`)
- Category leader awards (direct `totalPoints +=` in `categoryLeaderAwards.ts`)

The ledger computes day totals from actual activity data, so its sum
(`totalActivityPoints + totalStreakBonus`) was internally consistent but could
differ from the cached `participation.totalPoints`.

## Fix

- [x] Changed `getLedger` to compute `totalPoints` as `totalActivityPoints + totalStreakBonus`
  instead of reading from `participation.totalPoints`

This ensures the grand total always equals the sum of day totals displayed in the
ledger table.
