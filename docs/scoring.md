# Scoring System

This document explains how activity points are calculated. The core logic lives in `packages/backend/lib/scoring.ts`.

## Scoring Config Types

Every activity type has a `scoringConfig` object. The `type` field determines which scorer is used.

### `unit_based`

Points scale linearly with a metric value (distance, duration, etc.).

```json
{
  "type": "unit_based",
  "unit": "miles",
  "pointsPerUnit": 8,
  "basePoints": 0,
  "maxUnits": 3
}
```

- **`unit`** — metric key to read from the activity's metrics (e.g. `"miles"`, `"minutes"`, `"kilometers"`). The scorer resolves aliases automatically (`"miles"` matches `"distance_miles"`, `"mile"`, etc.).
- **`pointsPerUnit`** — multiplier applied to the metric value. Defaults to `1`.
- **`basePoints`** — flat points added on top. Defaults to `0`.
- **`maxUnits`** — optional cap on the metric value before multiplying.

**Formula:** `basePoints + min(unitValue, maxUnits) * pointsPerUnit`

**Special case — drinks:** When `unit` is `"drinks"`, a special scorer applies daily freebie logic. The first N drinks per day (default 1) are free; subsequent drinks incur negative points.

### `completion`

Flat points awarded for completing the activity. No metrics needed.

```json
{
  "type": "completion",
  "fixedPoints": 50,
  "optionalBonuses": [
    { "name": "Weighted Vest", "bonusPoints": 25, "description": "Completed with 20lb weighted vest" }
  ]
}
```

- **`fixedPoints`** — points awarded (also accepts `"points"` as an alias).
- **`optionalBonuses`** — user-selectable bonuses. The frontend sends `metrics.selectedBonuses: ["Weighted Vest"]` to trigger them.

### `tiered`

Points determined by which tier a metric value falls into.

```json
{
  "type": "tiered",
  "metric": "duration_minutes",
  "tiers": [
    { "maxValue": 10, "points": 50 },
    { "maxValue": 12, "points": 30 },
    { "points": 10 }
  ]
}
```

- **`metric`** — which metric key to evaluate.
- **`tiers`** — ordered from lowest to highest `maxValue`. The first tier where `metricValue <= maxValue` wins. The last tier (no `maxValue`) is the catch-all.

### `variable`

Admin-assigned points. The scorer returns `0` — points are set manually by admins.

```json
{ "type": "variable" }
```

### Default / no type

If `type` is omitted, the scorer checks for `unit` and falls back:
1. If `unit` exists → uses `unit_based` logic
2. Otherwise → returns `basePoints` as a flat value

**Important:** Always set an explicit `type`. Omitting it has caused bugs where `{ "basePoints": 4 }` was intended as per-unit scoring but was treated as a flat 4 points. See the `unit_based` and `completion` types above.

## Bonus Points

Bonuses are calculated separately from base points and stacked on top.

### Threshold Bonuses

Configured per activity type in `bonusThresholds`. Awarded when a metric exceeds a threshold.

```json
{
  "bonusThresholds": [
    { "metric": "distance_miles", "threshold": 13.1, "bonusPoints": 25, "description": "Half Marathon bonus" },
    { "metric": "distance_miles", "threshold": 26.2, "bonusPoints": 100, "description": "Marathon bonus" }
  ]
}
```

Multiple thresholds can trigger simultaneously (a marathon earns both bonuses).

The `metric` field maps to activity metrics via aliases: `distance_miles` checks `["miles", "distance_miles"]`, `distance_km` checks `["kilometers", "distance_km", "km"]`, etc.

### Optional Bonuses

User-selected bonuses on `completion` type activities (see above). The user picks which bonuses apply via `metrics.selectedBonuses`.

### Media Bonus

A global +1 point bonus for attaching a photo. Capped at once per day per challenge. Calculated in `calculateMediaBonus()`.

## Activity Type Restrictions

These fields on the activity type control when/how often it can be logged:

- **`validWeeks`** — array of week numbers (1-indexed) when this activity type is available. Empty = always available.
- **`maxPerChallenge`** — maximum number of times a user can log this activity type in a challenge. `undefined` or `0` = unlimited.
- **`contributesToStreak`** — whether points from this activity count toward the daily streak threshold.

## Strava Integration

When Strava activities arrive (via webhook or manual import), the system:

1. **Maps the Strava type** to an activity type via `integrationMappings` (explicit) or `SPORT_TYPE_MAPPING` (fallback name matching) in `lib/strava.ts`.
2. **Extracts metrics** from the Strava payload into a normalized format:
   - `miles` / `distance_miles` — distance in miles
   - `kilometers` / `distance_km` — distance in km
   - `minutes` / `duration_minutes` — elapsed time
   - `moving_minutes` — moving time
3. **Applies metric mapping** if configured on the integration mapping (e.g., convert km to miles with a `conversionFactor`).
4. **Runs the same scoring logic** as manual activities using `calculateActivityPoints()`.

The scoring preview (shown before confirming a Strava import) uses a simplified version of the same logic in `actions/strava.ts:calculateScoringPreview()`.

## Key Files

| File | Purpose |
|------|---------|
| `packages/backend/lib/scoring.ts` | Core scoring functions |
| `packages/backend/lib/strava.ts` | Strava metric extraction and activity type detection |
| `packages/backend/mutations/activities.ts` | Activity log/edit mutations (validation + scoring) |
| `packages/backend/mutations/stravaWebhook.ts` | Strava webhook → activity creation |
| `packages/backend/actions/strava.ts` | Strava API calls + scoring preview |
