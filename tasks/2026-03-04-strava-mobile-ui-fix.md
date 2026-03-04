# Strava Test Connection: Mobile UI Fix & Already-Imported Indicator

**Date:** 2026-03-04
**Description:** Fix mobile layout issues in the Strava test connection activity list, add already-imported detection, and improve error messages.

## Changes

- [x] **Backend: Return `alreadyImported` flag** — `testStravaConnection` now checks each activity against existing records in the challenge via `getExistingActivity` and returns `alreadyImported: boolean` per activity
- [x] **Mobile layout fix** — Changed points + import/synced badge from horizontal row to vertical column (`flex-col items-end`) with `shrink-0` to prevent cramping on narrow screens; added `gap-y-1` for wrapped date/badge metadata
- [x] **Already-imported indicator** — Activities previously synced via webhook now show a "Synced" badge with green border highlight on the card; header shows "X synced" count badge
- [x] **Rich error messages** — Error display now includes a contextual title (e.g., "Strava Connection Lost", "Duplicate Activity", "Strava Not Connected") with the raw message below and actionable hints for reconnection errors

## Implementation Notes

- `alreadyImported` is determined server-side by querying the `externalUnique` index — no extra client state needed
- The local `imported` Set still tracks activities imported during the current session (for immediate UI feedback after clicking Import)
- "Synced" label used instead of "Imported" to better reflect that most activities arrive via webhook
- Card border changes to `border-emerald-500/20` for already-imported activities to provide subtle visual grouping
