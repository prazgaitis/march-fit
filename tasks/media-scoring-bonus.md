# Media Scoring Bonus

**Date:** 2026-02-09
**Description:** Add +1 bonus point for activities with photos/media, and auto-import Strava photos.

## Changes

### 1. Media Bonus Point in Scoring Engine
- [x] Add `MEDIA_BONUS_POINTS` constant and `calculateMediaBonus()` function to `packages/backend/lib/scoring.ts`
- [x] Integrate media bonus into manual activity `log` mutation (`packages/backend/mutations/activities.ts`)
- [x] Integrate media bonus into Strava `createFromStrava` mutation (`packages/backend/mutations/stravaWebhook.ts`)
- [x] Media bonus appears as a triggered bonus ("Photo bonus") in the activity breakdown

### 2. Strava Photo Import
- [x] Update `StravaActivity` interface to include `photos` field (detailed activity response from Strava API)
- [x] Add `extractStravaPhotos()` helper to extract the highest-resolution primary photo URL
- [x] Add `stravaPhotoUrls` field to `MappedActivityData` interface
- [x] Store primary photo URL as `imageUrl` on activities imported from Strava
- [x] Update existing Strava activities with photo URL on re-sync

## Implementation Notes

- The Strava detailed activity endpoint (`/api/v3/activities/{id}`) returns a `photos` object with `primary.urls` containing different resolutions. We extract the largest available resolution.
- The media bonus is applied uniformly: +1 point if `mediaIds` has entries, `imageUrl` is set, or Strava photos are present.
- The bonus is stored as a triggered bonus with `metric: "media"` and `description: "Photo bonus"` so it's visible in activity details.
- No schema changes needed — `imageUrl` already exists on the activities table.
