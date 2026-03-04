# Strava Test Connection: Mobile UI Fix, Already-Imported Indicator & Duplicate Detection

**Date:** 2026-03-04
**Description:** Fix mobile layout issues in the Strava test connection activity list, add already-imported detection, duplicate detection for manually-logged activities, and improve error messages.

## Changes

- [x] **Backend: Return `alreadyImported` flag** — `testStravaConnection` now checks each activity against existing records in the challenge via `getExistingActivity` and returns `alreadyImported: boolean` per activity
- [x] **Mobile layout fix** — Changed points + import/synced badge from horizontal row to vertical column (`flex-col items-end`) with `shrink-0` to prevent cramping on narrow screens; added `gap-y-1` for wrapped date/badge metadata
- [x] **Already-imported indicator** — Activities previously synced via webhook now show a "Synced" badge with green border highlight on the card; header shows "X synced" count badge
- [x] **Rich error messages** — Error display now includes a contextual title (e.g., "Strava Connection Lost", "Duplicate Activity", "Strava Not Connected") with the raw message below and actionable hints for reconnection errors
- [x] **Duplicate detection library** — Pure, testable `findPotentialDuplicates()` function that compares Strava activities against manually-logged activities by date, activity type, and metric similarity (duration ±15%, distance ±15%)
- [x] **Internal query for manual activity lookup** — `getManualActivitiesForDateRange` fetches manual activities within a date range using the `by_user_challenge_date` index
- [x] **Duplicate detection in testStravaConnection** — Each activity in the response now includes a `potentialDuplicate` field with confidence level ("high" when both duration and distance match, "medium" for a single metric match) and a human-readable reason
- [x] **Duplicate UI indicators** — Activity cards with potential duplicates show an amber border and a "Possible duplicate" warning with match details; header shows count of duplicates found
- [x] **30 unit tests** — Comprehensive test coverage for `isWithinTolerance`, `compareMetrics`, and `findPotentialDuplicates` covering edge cases (boundary values, missing metrics, date handling, multiple candidates, etc.)

## Implementation Notes

- `alreadyImported` is determined server-side by querying the `externalUnique` index — no extra client state needed
- The local `imported` Set still tracks activities imported during the current session (for immediate UI feedback after clicking Import)
- "Synced" label used instead of "Imported" to better reflect that most activities arrive via webhook
- Card border changes to `border-emerald-500/20` for already-imported activities to provide subtle visual grouping
- Duplicate detection is purely informational — flagged duplicates are displayed but no action is taken automatically
- The `compareMetrics` function checks `minutes`, `distance_miles`/`miles`, and `distance_km`/`kilometers` with fallback key aliases for scoring compatibility
- High confidence requires both duration AND distance to match; medium requires at least one
