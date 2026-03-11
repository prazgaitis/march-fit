# 2026-03-10: Category Leaders — Use Raw Metrics Instead of Points

Category leaders should be ranked by total raw metric values (e.g., miles run, minutes exercised) rather than total points, because points include bonuses (marathon bonus, media bonus, etc.) that distort the actual metric totals.

**Example:** If user A ran 30mi across a week and user B ran a marathon (26.2mi), user A should be ahead — but currently user B wins due to marathon bonus points inflating their category point total.

## Changes

- [x] Add `totalMetricValue` to `categoryPoints` and `weeklyCategoryPoints` schema
- [x] Export `getMetricValueForUnit` from scoring.ts and add `extractActivityMetricValue` helper
- [x] Update `applyCategoryPointsDelta` and `applyWeeklyCategoryPointsDelta` to accept and track `metricDelta`
- [x] Update `applyParticipationScoreDeltaAndRecomputeStreak` to pass metric deltas
- [x] Update all callers: activities.ts, stravaWebhook.ts, admin.ts, apiMutations.ts, rescoreStrava.ts
- [x] Fix leader queries (preview + apply mutations) to sort by `totalMetricValue`
- [x] Update admin UI to display metric values
- [x] Create backfill mutation to recalculate from existing activities

## Implementation Notes

- `totalMetricValue` is extracted from `activityType.scoringConfig.unit` + `activity.metrics` using the existing `getMetricValueForUnit` function
- For activity types without a configured unit, metric value defaults to 0
- Sorting uses `totalMetricValue` with fallback to `totalPoints` for backward compat
- Backfill scans all non-deleted activities per challenge, groups by category, and recomputes both tables
