# Strava Photos Sync Fix
**Date:** 2026-03-09

## Problem
When a Strava activity is synced, photos uploaded by the user are stored as `imageUrl` (a Strava CDN URL) but never uploaded to Cloudinary. The feed pipeline only renders `mediaUrls` (from `mediaIds`) and `cloudinaryPublicIds`, so Strava photos are invisible.

Additionally, Strava processes photos asynchronously and does NOT send webhook events for media, so photos may not be available when we initially fetch the activity.

## Root Cause (verified via production data)
- **0 data gaps**: All activities where Strava had `total_photo_count > 0` also had `imageUrl` stored
- **Display pipeline mismatch**: Feed queries return `mediaUrls`/`cloudinaryPublicIds` but not `imageUrl`
- **Strava confirmed**: "We don't return any webhook events for media" (Strava Community Hub)
- **Only primary photo**: `extractStravaPhotos` only gets 1 photo from `photos.primary`, missing additional photos

## Implementation

- [x] Add `total_photo_count` to `StravaActivity` type
- [x] Add `pendingMediaCount` schema field to track expected-but-unavailable photos
- [x] Add `httpFetchStravaActivityPhotos()` — fetches ALL photos via `/activities/{id}/photos?size=2048`
- [x] Add `uploadPhotosToCloudinary()` — downloads photos and uploads via unsigned preset
- [x] In `processStravaWebhook`: after creating activity, download all Strava photos and upload to Cloudinary
- [x] If photos not yet available (async), schedule 90s delayed retry via `retryStravaActivityPhotos`
- [x] `retryStravaActivityPhotos` also fetches all photos and uploads to Cloudinary
- [x] `patchCloudinaryIds` clears `pendingMediaCount` when photos are uploaded

## Files Changed
- `packages/backend/actions/strava.ts` — photo download/upload pipeline, retry logic
- `packages/backend/lib/strava.ts` — `total_photo_count` on StravaActivity type
- `packages/backend/mutations/stravaWebhook.ts` — `pendingMediaCount` tracking
- `packages/backend/mutations/backfillCloudinary.ts` — clear `pendingMediaCount` on patch
- `packages/backend/schema.ts` — `pendingMediaCount` field on activities
