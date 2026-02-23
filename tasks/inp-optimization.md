# INP Optimization - Mobile Performance

**Date:** 2026-02-22
**Description:** Fix poor Interaction to Next Paint (INP) scores on mobile. P75 INP is 1,048ms (should be <200ms).

## Worst Routes (by INP)
- `/` — 7,176ms
- `/challenges/[id]/activities` — 2,096ms
- `/challenges/[id]/users/...` — 1,568ms
- `/challenges/[id]/leaderboard` — 1,528ms
- `/challenges/[id]/forum` — 1,480ms
- `/challenges/[id]/dashboard` — 1,152ms

## Root Causes
1. Monolithic client components with 10+ useState calls causing full-tree re-renders
2. Like/upvote state at parent level re-rendering all list children
3. No React.memo on list item components (ActivityCard, ForumPostCard, EntryRow)
4. ChallengeRealtimeProvider causes cascade re-renders across all consumers
5. Heavy dynamic imports (RichTextEditor/TipTap) triggered eagerly
6. setState during render in WeeklyCategoryLeaderboard
7. Queries fetched before needed (activity types fetched unconditionally)

## Fixes

- [x] Wrap ActivityCard in React.memo + move pendingLikes to local state
- [x] Wrap ForumPostCard in React.memo + fix upvote pattern
- [x] Wrap leaderboard EntryRow in React.memo
- [x] Split ChallengeRealtimeProvider context
- [x] Defer heavy queries until needed
- [x] Fix setState during render in WeeklyCategoryLeaderboard
- [ ] Lazy-load RichTextEditor more aggressively (future)
