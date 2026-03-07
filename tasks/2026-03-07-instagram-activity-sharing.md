# Instagram Activity Sharing

**Date:** 2026-03-07
**Description:** Build shareable activity cards for Instagram stories, similar to Strava's share cards.

## Requirements

- [x] Generate shareable image cards from activities using Canvas API
- [x] Multiple card style variants:
  - **Activity Card** — Shows activity type, points earned, date, and metrics
  - **Leaderboard Card** — Shows activity + user's current rank and total points
  - **Streak Card** — Shows activity + current streak with fire visual
- [x] Share dialog with style picker (thumbnail previews of each variant)
- [x] Download as PNG for sharing to Instagram stories
- [x] Web Share API integration for mobile devices
- [x] Dark, bold aesthetic matching the brand (black bg, indigo/fuchsia accents)
- [x] Integration points: activity detail page + activity feed items

## Implementation Notes

- Uses browser Canvas API directly (no extra dependencies)
- Card dimensions: 1080x1920 (Instagram story aspect ratio 9:16)
- Share data (rank, streak) pulled from existing challenge summary context
- New Convex query for activity-specific share data with rank info
