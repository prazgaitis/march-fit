# Infinite Scroll Feeds

**Date:** 2026-03-17
**Description:** Replace all "Load more" buttons with infinite scroll across feeds and paginated lists.

## Requirements

- [x] Create a reusable `useInfiniteScroll` hook using IntersectionObserver
- [x] Replace "Load more" button in activity feed (All/Following tabs) with infinite scroll
- [x] Replace "Load more" button in For You feed — after algo entries are exhausted, seamlessly load chronological activities
- [x] Replace "Load more" button in forum content with infinite scroll
- [x] Replace "Load more" button in admin forum page with infinite scroll
- [x] Replace "Load more" button in user activities page with infinite scroll
- [x] Replace "Load more" button in activity detail comments with infinite scroll

## Implementation Notes

- Used a shared `useInfiniteScroll` hook at `apps/web/hooks/use-infinite-scroll.ts`
- Hook uses IntersectionObserver with a sentinel div that triggers `loadMore` when it enters the viewport
- Added a bottom margin (`rootMargin: "0px 0px 400px 0px"`) for pre-fetching before the user reaches the bottom
- Shows a loading spinner instead of "Load more" button when fetching the next page
- For You feed: when algo entries are exhausted, the same infinite scroll triggers `handleLoadMore` which loads more algo entries; once all algo entries are visible it falls through to chronological feed
