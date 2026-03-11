# 2026-03-10: Display Raw Metrics in Category Leaderboard UI

The category leader award system was updated to rank by raw metric values (miles, minutes, etc.) instead of points, but the public-facing leaderboard UI still displayed points. This PR updates the queries and UI to show metric values with units.

## Changes

- [x] Update `getCumulativeCategoryLeaderboard` query to sort by `totalMetricValue` and return unit per category
- [x] Update `getWeeklyCategoryLeaderboard` query to sort by `totalMetricValue` and return unit per category
- [x] Update cumulative category leaderboard UI to display metric values with units
- [x] Update weekly category leaderboard UI to display metric values with units

## Implementation Notes

- Both queries build a `categoryUnitMap` from activity types' `scoringConfig.unit` (same pattern as `previewWeeklyAwards`)
- Sorting uses `totalMetricValue` with fallback to `totalPoints` when metric data isn't populated
- Display format: `{value} {unit}` (e.g., "42.5 miles") with fallback to `{points} pts`
- `PointsDisplay` component replaced with inline metric formatting since we're no longer showing points
