# Fix Achievement Metric Unit Conversion

**Date:** 2026-03-29

**Description:** The MF Marathon Triathlon achievement wasn't being awarded because some activities store metrics in different units than what the achievement criteria expects (e.g., rowing stores `kilometers` but the achievement checks `distance_miles`).

## Root Cause

The `getMetricValue` function only checks keys for the requested metric (e.g., `distance_miles` checks `["miles", "distance_miles", "distance"]`). When an activity stores its value under a different unit key (e.g., `kilometers`), the lookup returns 0 and the achievement is never awarded.

Cougar's rowing activity: `{ "kilometers": 55.057 }` (55km = ~34.2 miles, well above 26.2 mile marathon threshold) was not being matched.

## Changes

- [x] Add `getMetricValueWithConversion` to `lib/achievements.ts` — falls back to cross-unit conversion (km↔miles) when direct lookup returns 0
- [x] Use `getMetricValueWithConversion` in `n_of_thresholds` and `all_activity_type_thresholds` evaluators
- [x] Mirror changes in `lib/achievementCriteria.ts` for consistency
- [x] Update prod achievement config: rowing requirement now uses `distance_km` with threshold `42.195` (marathon in km)
- [x] Add `backfillAchievements` internal mutation to retroactively award achievements to all participants who qualify
