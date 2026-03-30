# Investigate PR Bonus Issue

**Date:** 2026-03-30
**Description:** User KGP reports missing PR bonus on challenge `js7039jtvp6z79d0r37h1x70qn8105zw`.

## Investigation

- [x] Review PR week calculation logic
- [x] Compare preview vs actual calculation code paths
- [x] Identify any bugs or inconsistencies

## Findings

### Bug: Inconsistent activity type filtering between preview and actual PR week calculations

**Initial PR** (`miniGameCalculations.ts:calculateMaxDailyPoints`) uses `getPrEligibleTypeIds`
to filter activities, only counting core/special/penalty kinds.

**Week max (preview)** (`miniGameCalculations.ts:getMaxDailyPointsInPeriod`) also uses
`getPrEligibleTypeIds` — consistent with initialPr.

**Week max (actual end mutation)** (`mutations/miniGames.ts:getMaxDailyPointsInPeriod`) only
filters by `source !== "mini_game"`, NOT by PR-eligible activity type kinds. This means
bonus-kind activities (mindfulness, category leader, etc.) are included in weekMaxPoints but
excluded from initialPr.

**Impact:** The inconsistency inflates weekMaxPoints relative to initialPr, making it
*easier* to beat the PR (not harder). So this bug wouldn't cause KGP's missing bonus — they
likely didn't exceed their PR. However, the bug could award false positives (someone beats
their PR only because bonus-kind activities were included).

### Fix

Align the mutation's `getMaxDailyPointsInPeriod` with the shared library version by adding
`getPrEligibleTypeIds` filtering.

## Data verification needed

Without database access, we cannot confirm KGP's actual initialPr vs weekMaxPoints values.
An admin should check via:
- `GET /api/v1/mini-games/:id` — to see the participant's outcome (initialPr, weekMaxPoints, hitPr)
- Or run `npx convex run` queries against the challenge to inspect KGP's activities
