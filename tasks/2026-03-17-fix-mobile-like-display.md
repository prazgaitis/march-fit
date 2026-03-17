# Fix Mobile Like Display & Optimistic Updates

**Date:** 2026-03-17

## Problem

1. Like counts and "Liked by" text were hidden on mobile due to `lightweightFeedMode` gating engagement counts
2. Like action was not snappy — waited for server response before updating UI
3. Activity detail page showed "Liked by you and (your own name)" because `currentUserId` was not passed to `LikesDisplay`

## Changes

### Always show like counts on mobile
- [x] Remove `!lightweightFeedMode` gating from `includeEngagementCounts` in feed queries (always `true`)
- [x] Pass `showEngagementCounts` as always-true to `ActivityCard` in all feed tabs

### Optimistic like updates in feed (`ActivityCard`)
- [x] Replace `isLiking` boolean with `optimisticLiked` / `optimisticLikeCount` state
- [x] Immediately update UI on like tap, revert on error
- [x] Reset optimistic state when server data catches up via `useEffect`
- [x] Use `effectiveLiked` / `effectiveLikeCount` for rendering heart icon, count, and `LikesDisplay`

### Optimistic like updates on activity detail page
- [x] Same optimistic pattern as feed
- [x] Add `useQuery(api.queries.users.current)` to get `currentUserId`
- [x] Pass `currentUserId` to `LikesDisplay` (fixes "you and your-own-name" bug)

## Files Modified

- `apps/web/components/dashboard/activity-feed.tsx`
- `apps/web/app/challenges/[id]/(dashboard)/activities/[activityId]/activity-detail-content.tsx`
