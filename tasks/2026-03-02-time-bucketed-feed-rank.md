# Time-Bucketed feedRank for Algorithmic Feed

**Date:** 2026-03-02

## Summary

Replace time-decay-based feed scoring with a time-bucketed `feedRank` field.
Today's mediocre post always ranks above yesterday's viral post. Within the
same day, content quality breaks ties. Following boost applied at query time.

## Changes

- [x] Add `feedRank` field and `challengeFeedRank` index to schema
- [x] Add `computeFeedRank(feedScore, createdAtMs)` — `dayBucket * 1000 + clamp(feedScore, 0, 999)`
- [x] Add `computePersonalizedRank(feedRank, isFollowing)` — `feedRank + FOLLOWING_BOOST`
- [x] Add `computeInitialScores()` returning `{ feedScore, feedRank }`
- [x] Update `recomputeFeedScore` to also patch `feedRank`
- [x] Update `insertActivity` to set both `feedScore` and `feedRank`
- [x] Switch algorithmic feed query to `challengeFeedRank` index + `computePersonalizedRank`
- [x] Update backfill to filter on `feedRank === undefined` and compute both fields
- [x] Add unit tests for `computeFeedRank` and `computePersonalizedRank`
- [x] Fix existing `computeDisplayScore` tests (legacy uses hardcoded boost=15)

## Notes

- `FOLLOWING_BOOST` changed from 15 to 1000 (promotes followed users by ~1 day bucket)
- Legacy `computeTimeDecay` and `computeDisplayScore` kept for cleanup PR
- Old `challengeFeedScore` index kept for cleanup PR
- Backfill command: `npx convex run mutations/backfillFeedScore:backfillFeedScore '{"batchSize": 100, "dryRun": false, "challengeId": "<id>"}'`
