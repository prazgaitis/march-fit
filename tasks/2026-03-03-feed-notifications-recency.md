# 2026-03-03 Fix: Feed-aware notifications + recency weighting in algorithmic feed

## Problem
1. Phantom notifications on "For You" tab — global `latestActivityId` may not appear in algorithmic feed
2. No time decay in algorithmic feed — old activities dominate
3. Notification system not feed-tab-aware

## Changes

### 1. Apply time decay in algorithmic feed query
- [x] `packages/backend/queries/algorithmicFeed.ts` — Switch from `computePersonalizedRank(feedRank)` to `computeDisplayScore(feedScore, ..., createdAtMs, nowMs, affinityScore)`

### 2. Make "For You" notifications track algo feed top item
- [x] `apps/web/components/dashboard/activity-feed.tsx` — Track `lastSeenAlgoTopId` ref; show banner only when algo feed top changes, not on global `latestActivityId`

### 3. Keep "All" and "Following" notifications unchanged
- [x] Existing `hasNewActivity` + `latestActivityVisible` logic remains for non-algo tabs
