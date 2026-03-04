# Recency-First Algorithmic Feed

**Date:** 2026-03-03

## Summary

Refactored the algorithmic feed to use recency as a hard filter (fetch last N activities by creation time) then rank purely by interestingness (content quality + engagement + social relevance). Removed time decay which was competing with day bucketing and causing old activities to appear too prominently.

## Changes

- [x] Simplified `feedScoring.ts` — removed `computeTimeDecay`, `DECAY_HALF_LIFE_HOURS`, `DECAY_POWER`; simplified `computeDisplayScore` to just `feedScore + followBoost + affinityBoost`
- [x] Rewrote `algorithmicFeed.ts` query — removed pagination, fetch last N activities by `_creationTime` DESC via `.take(candidateLimit)`, score and sort by `displayScore`
- [x] Updated `activity-feed.tsx` — switched algo feed from `usePaginatedQuery` to `useQuery`, removed load-more for "For You" tab
- [x] Updated `algorithmic-feed.tsx` — switched from `usePaginatedQuery` to `useQuery`, removed load-more UI
- [x] Updated `dashboard/page.tsx` — removed `paginationOpts` from server-side algo feed preload
- [x] Updated `admin.ts` — sort candidates by `_creationTime` DESC, removed time decay from debug output
- [x] Updated admin algofeed page — removed decay tuning controls and decay column from debug table
- [x] Updated feed scoring tests — removed `computeTimeDecay` tests, updated `computeDisplayScore` tests for new signature
- [x] Fixed affinity test — removed `paginationOpts` from algo feed query call

## What stayed unchanged

- Schema/indexes (removing indexes needs migration)
- `feedScore` computation (content quality + engagement)
- `feedRank` writes at creation time (harmless)
- "All" and "Following" feed tabs (chronological, unaffected)
