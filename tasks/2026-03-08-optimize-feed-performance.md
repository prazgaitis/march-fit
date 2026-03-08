# Optimize Feed Performance

**Date:** 2026-03-08

Two performance improvements for the dashboard:

## Story Image Preloading

- [x] Prefetch upcoming story slide images so they load instantly when the user navigates forward
- [x] Preload the next 2 slides (current story + next story) using `Image()` constructor

## Feed Like Optimistic Updates

- [x] Add optimistic UI for liking/unliking activities in the main feed
- [x] Update heart icon, like count, and recent likers immediately without waiting for server response
- [x] Revert on error
