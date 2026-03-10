# Reactive For You Feed

**Date:** 2026-03-09

## Problem

The "For You" feed used a snapshot-based approach (`convexClient.query` one-shot) that never updated after mutations. When a user liked an activity, the heart button didn't toggle visually until the feed was manually refreshed.

## Solution

Split the algorithmic feed into two layers:

1. **Ranking query** (`getRankedActivityIds`) — lightweight query that returns only sorted activity IDs. Handles personalized scoring (following boost, affinity, time decay) without hydrating activity data.

2. **Per-card reactive subscriptions** (`ReactiveActivityCard`) — each card in the For You feed subscribes to `getById` via `useQuery`, making likes, comments, and all engagement instantly reactive.

### Changes

- [x] Added `getRankedActivityIds` query to `algorithmicFeed.ts` — returns only sorted IDs
- [x] Added `ReactiveActivityCard` component that subscribes to `getById` per card
- [x] For You tab renders via reactive cards with client-side pagination (10 at a time)
- [x] Removed snapshot-based algo feed logic (`algoSnapshot`, `fetchAlgoFeed`, `AlgoFeedItem`, `mapAlgoItem`)
- [x] Removed SSR preload of algo feed from dashboard and insta pages
- [x] Removed `initialAlgoItems` prop from `ActivityFeed`, `InstaFeed`, `StoriesSection`
- [x] `StoriesSection` already had its own reactive `useQuery` — just removed the SSR fallback

### Architecture

```
Before:  SSR full hydration → snapshot in state → stale after mutations
After:   Ranking query (IDs) → N reactive subscriptions (only visible cards)
```

- Only ~10 cards are subscribed at a time (client-side pagination)
- Convex deduplicates shared queries (e.g., `getFollowingIds`) across cards
- Load more adds 10 more cards, each mounting their own subscription
