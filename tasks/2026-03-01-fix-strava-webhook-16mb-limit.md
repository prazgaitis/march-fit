# Fix Strava Webhook 16MB Read Limit

**Date:** 2026-03-01
**Issue:** Strava webhook processing exceeds Convex's 16MB byte read limit

## Problem

The `createFromStrava` mutation hits Convex's 16MB read limit when
`recomputeStreakForUserChallenge` loads all activities for a user+challenge.
Old activity documents still have `externalData` on them (the full Strava
detailed API response), which can be 50-200KB per document due to fields like
`segment_efforts`, `laps`, `splits_metric`, `map.polyline`, etc.

With 100+ un-migrated activities, the total bytes read exceeds 16MB.

## Root Cause

1. `recomputeStreakForUserChallenge` (participationScoring.ts) does
   `.collect()` on ALL activities for the user+challenge.
2. Old activity documents still have `externalData` (full Strava response)
   inline — the backfill to the `activityExternalData` companion table has
   not been run on production.
3. The Strava detailed response includes massive unnecessary fields
   (`segment_efforts`, `laps`, `splits_metric`, `map.polyline`, etc.) that
   inflate each document to 50-200KB+.

## Fix

- [x] Sanitize Strava externalData before storing — whitelist only the fields
  we actually use, stripping segment_efforts, laps, splits, polylines, etc.
  Reduces per-document size from 50-200KB to ~1-2KB.
- [x] Run the existing backfill on production to migrate externalData from
  activity documents to the companion table.

## Backfill Instructions

Run the existing backfill action on production:

```bash
npx convex run actions/backfillActivityExternalData:backfillActivityExternalData --prod
```

This is safe to re-run (idempotent). It migrates `externalData` from activity
documents to the `activityExternalData` companion table and clears the field
from the activity document.

## Implementation Notes

- New activities already route externalData to the companion table via
  `insertActivity()` / `patchActivity()` in `lib/activityWrites.ts`.
- The sanitization applies a whitelist of essential Strava fields, so any new
  large fields Strava adds in the future won't bloat storage.
- After the backfill completes, each activity document is ~700 bytes. Even
  with 10,000+ activities per user per challenge, total reads stay well under
  16MB.
