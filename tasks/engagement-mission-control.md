# Engagement Mission Control

**Date:** 2026-03-10
**Description:** Dedicated platform engagement analytics dashboard in the admin panel.

## Features

- [x] Activities logged by hour chart
- [x] Likes per hour chart
- [x] Comments per hour chart
- [x] Follow network graph/stats
- [x] Sort all activities by feed score
- [x] DB-safe: bounded queries, index usage, no full table scans

## Implementation Notes

- Backend query uses bounded `take()` calls and indexed queries to avoid overloading the DB
- Likes/comments queried via `createdAt` index with cap, then filtered to challenge activities
- Follows queried per-participant using `followerId` index, filtered to intra-challenge connections
- Activities sorted by `challengeFeedScore` index for efficient feed score sorting
- Frontend uses existing AdminCard/StatCard/SectionHeader components with custom bar charts (no external charting library needed)
