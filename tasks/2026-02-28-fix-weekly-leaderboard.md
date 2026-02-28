# 2026-02-28 Fix Weekly Category Leaderboard

## Problem

`getWeeklyCategoryLeaderboard` reads every activity document for a week via
`activities.challengeLoggedDate` index. Because `activities.externalData` stores
the full raw Strava API response (~3-5KB each), a challenge with 500 participants
logging 10 activities/week = 5,000 docs × 3-5KB = 15-25MB, exceeding Convex's
16MB query read limit.

`getCumulativeCategoryLeaderboard` was already fixed by pre-aggregating into a
`categoryPoints` table.

## Solution

Two complementary changes:

### A. Pre-aggregate weekly category points (mirrors cumulative pattern)

- [x] Add `weeklyCategoryPoints` table to schema
- [x] Create `applyWeeklyCategoryPointsDelta` helper
- [x] Wire into `applyParticipationScoreDeltaAndRecomputeStreak` (adds optional `loggedDate` + `challengeStartDate`)
- [x] Handle date/type changes in edit paths (explicit unapply/reapply, parallel to existing cumulative type-change pattern)
- [x] Rewrite `getWeeklyCategoryLeaderboard` to read from `weeklyCategoryPoints`
- [x] Add backfill script (`actions/backfillWeeklyCategoryPoints.ts`)

### B. Move externalData to companion table (fix root cause)

- [x] Add `activityExternalData` table to schema
- [x] Modify `insertActivity` to strip externalData and write to companion table
- [x] Modify `patchActivity` to strip externalData and upsert to companion table
- [x] Add backfill script (`actions/backfillActivityExternalData.ts`)
- [ ] Run backfill on production (manual, after deploy)

## Write-path changes

Every site that calls `applyParticipationScoreDeltaAndRecomputeStreak` or
`applyCategoryPointsDelta` now also maintains `weeklyCategoryPoints`:

| File | Change |
|------|--------|
| `lib/participationScoring.ts` | Common path: when `loggedDate` + `challengeStartDate` provided, also calls weekly delta |
| `mutations/activities.ts` | `log`: pass loggedDate/startDate. `editActivity`: handle date/type swap |
| `mutations/admin.ts` | `adminEditActivity`: handle date/type swap |
| `mutations/stravaWebhook.ts` | `createFromStrava`: all sub-paths. `deleteFromStrava`: pass loggedDate |
| `mutations/apiMutations.ts` | `logActivityForUser`, `removeActivityForUser`, `adminEditActivityForUser` |
| `mutations/rescoreStrava.ts` | Not modified — backfill handles historical data |

## Notes

- Backfill scripts are created but NOT wired to migrations
- `externalData` field kept in activities schema for backward compat until backfill runs
- `rescoreStrava.ts` not modified (one-off fix script; backfill covers it)
