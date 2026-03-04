# Strava Settings: Unlink, Test Connection & Manual Import

**Date:** 2026-03-04
**Description:** Add Strava management section to the user settings page with unlink, test connection, and manual activity import capabilities.

## Changes

- [x] Add `unlinkStrava` mutation — soft-revokes integration (sets `revoked: true`, clears tokens), preserves synced activities
- [x] Add `getActiveStravaForUser` internal query — looks up active Strava integration for a user
- [x] Add `testStravaConnection` action — user-facing action that fetches recent Strava activities with scoring preview
- [x] Add `importStravaActivity` action — imports a single Strava activity into the current challenge (delegates to `createFromStrava`)
- [x] Build `StravaSettingsSection` component — Strava card in settings page with connect/disconnect/test/import
- [x] Integrate into settings page between Profile and Account Security
- [x] Add Sentry error context for all Strava operations (unlink, test, import)

## Implementation Notes

- `unlinkStrava` does NOT delete activities — sets `revoked: true` and clears access/refresh tokens
- `testStravaConnection` handles token refresh internally (user never sees raw tokens)
- `importStravaActivity` reuses `createFromStrava` internal mutation for consistent scoring, streaks, and category points
- Duplicate import protection via `externalId` check
- Each activity card shows: name, local time, sport type, metrics, mapped activity type, points preview, triggered bonuses
- Import button disabled for unmapped activity types
- Sentry captures include area, challengeId, userId, and action-specific extra context
