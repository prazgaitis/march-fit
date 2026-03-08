# For You Feed Freshness

**Date:** 2026-03-07

## Problem

The "For You" feed shows the same top activities every time because scoring is purely based on content quality + engagement with no time decay. Additionally, the feed is reactive (live-updates via Convex `useQuery`), silently reshuffling under the user. Should work like X/Twitter — stable snapshot that refreshes on user action.

## Changes

### Backend: Scoring (`feedScoring.ts`)

- [x] Replace tiered `descriptionBoost(length)` with flat `hasDescription` boolean (+10)
- [x] Add `computeDecayedScore(feedScore, ageMs, isFollowing, affinityScore)`:
  - Quality decay: `feedScore × 0.5^(ageHours / 18)` (18h half-life)
  - Freshness bonus: `15 × 0.5^(ageHours / 6)` (6h half-life)
  - Formula: `(feedScore + freshnessBonus) × qualityDecay + followingBoost + affinityBoost`
- [x] Update `ContentScoreInput` to use `hasDescription: boolean` instead of `notesLength: number`

### Backend: Feed Score persistence (`feedScore.ts`)

- [x] Update `contentInputFromActivity` to derive `hasDescription` from `activity.notes`

### Backend: Algo feed query (`algorithmicFeed.ts`)

- [x] Use `computeDecayedScore` with `Date.now()` instead of `computeDisplayScore`

### Frontend: Snapshot feed (`activity-feed.tsx`)

- [x] Replace `useQuery` for For You with a snapshot pattern (fetch once, re-fetch on explicit refresh)
- [x] Wire "New activities" banner to trigger snapshot re-fetch + scroll to top
- [x] Remove the separate `hasNewAlgoContent` detection (use `hasNewActivity` from challenge summary instead)

### Tests

- [x] Update `feed-scoring.test.ts` for new description scoring and decay functions
